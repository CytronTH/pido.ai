"""Project data storage: Variables and Collections.

The platform stores user data in two shapes:

* **Variables** – single numeric time-series written by the *Database Writer* node
  into ``custom_metric_log`` (telemetry DB). Grouped by ``(node_id, variable_name)``.
* **Collections** – user-defined tables. The schema lives in ``project_collections``
  (config DB) and rows written by the *Collection Writer* node live in
  ``collection_records`` (telemetry DB) as JSON.

All DB work is synchronous SQLModel code, so every endpoint offloads it with
``asyncio.to_thread`` to keep the event loop free.
"""
import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlmodel import Session, delete, func, select

from db.database import db
from db.models import CollectionRecord, ProjectCollection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}", tags=["project-data"])

SNAPSHOTS_DIR = Path(__file__).resolve().parents[3] / "snapshots"
FIELD_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
MAX_PAGE_SIZE = 500


# ── Schemas ──────────────────────────────────────────────────────────────────

class CollectionField(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=100)
    type: Literal["string", "number", "boolean", "image"] = "string"

    @field_validator("key")
    @classmethod
    def _valid_key(cls, v: str) -> str:
        if not FIELD_KEY_RE.match(v):
            raise ValueError("Field key must start with a letter/underscore and contain only letters, digits, or '_'")
        return v


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    schema_fields: List[CollectionField] = Field(..., min_length=1)

    @field_validator("schema_fields")
    @classmethod
    def _unique_keys(cls, v: List[CollectionField]) -> List[CollectionField]:
        keys = [f.key for f in v]
        if len(keys) != len(set(keys)):
            raise ValueError("Column keys must be unique")
        return v


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_schema(schema_json: Optional[str]) -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(schema_json or "[]")
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError):
        return []


def _parse_record_data(data_json: Any) -> Dict[str, Any]:
    if isinstance(data_json, dict):
        return data_json
    try:
        parsed = json.loads(data_json or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError):
        return {}


def _iso_utc(ts: Any) -> Optional[str]:
    """Return an ISO-8601 string with explicit UTC offset so browsers parse it correctly."""
    if ts is None:
        return None
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts)
        except ValueError:
            return ts
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.isoformat()


def _delete_snapshot_files(records: List[CollectionRecord]) -> int:
    """Delete snapshot images referenced by collection records. Only touches files in SNAPSHOTS_DIR."""
    deleted = 0
    for r in records:
        for v in _parse_record_data(r.data_json).values():
            if not isinstance(v, str) or "snapshots/" not in v:
                continue
            filepath = SNAPSHOTS_DIR / Path(v).name  # .name prevents path traversal
            try:
                if filepath.is_file():
                    filepath.unlink()
                    deleted += 1
            except OSError as e:
                logger.warning("Failed to delete snapshot %s: %s", filepath, e)
    return deleted


def _get_collection_or_404(session: Session, project_id: str, collection_id: str) -> ProjectCollection:
    coll = session.get(ProjectCollection, collection_id)
    if not coll or coll.project_id != project_id:
        raise HTTPException(status_code=404, detail="Collection not found")
    return coll


def _serialize_collection(c: ProjectCollection, stats: Dict[str, Any]) -> Dict[str, Any]:
    s = stats.get(c.id, {})
    return {
        "id": c.id,
        "project_id": c.project_id,
        "name": c.name,
        "schema_json": c.schema_json,  # kept for CollectionWriterSettings compatibility
        "schema": _parse_schema(c.schema_json),
        "created_at": _iso_utc(c.created_at),
        "record_count": s.get("count", 0),
        "last_record_at": _iso_utc(s.get("last")),
    }


# ── Collections ──────────────────────────────────────────────────────────────

def _list_collections(project_id: str) -> List[Dict[str, Any]]:
    with Session(db.engine) as session:
        colls = session.exec(
            select(ProjectCollection)
            .where(ProjectCollection.project_id == project_id)
            .order_by(ProjectCollection.created_at)
        ).all()
    stats: Dict[str, Dict[str, Any]] = {}
    if colls:
        with Session(db.engine_telemetry) as session:
            rows = session.exec(
                select(CollectionRecord.collection_id, func.count(CollectionRecord.id), func.max(CollectionRecord.timestamp))
                .where(CollectionRecord.project_id == project_id)
                .group_by(CollectionRecord.collection_id)
            ).all()
            stats = {cid: {"count": cnt, "last": last} for cid, cnt, last in rows}
    return [_serialize_collection(c, stats) for c in colls]


@router.get("/collections")
async def get_project_collections(project_id: str) -> Dict[str, Any]:
    data = await asyncio.to_thread(_list_collections, project_id)
    return {"status": "success", "data": data}


def _create_collection(project_id: str, payload: CollectionCreate) -> Dict[str, Any]:
    with Session(db.engine) as session:
        exists = session.exec(
            select(ProjectCollection)
            .where(ProjectCollection.project_id == project_id)
            .where(ProjectCollection.name == payload.name.strip())
        ).first()
        if exists:
            raise HTTPException(status_code=409, detail=f"A collection named '{payload.name}' already exists")
        coll = ProjectCollection(
            id=str(uuid.uuid4()),
            project_id=project_id,
            name=payload.name.strip(),
            schema_json=json.dumps([f.model_dump() for f in payload.schema_fields]),
        )
        session.add(coll)
        session.commit()
        session.refresh(coll)
        logger.info("Created collection '%s' (%s) for project %s", coll.name, coll.id, project_id)
        return _serialize_collection(coll, {})


@router.post("/collections")
async def create_project_collection(project_id: str, payload: CollectionCreate) -> Dict[str, Any]:
    data = await asyncio.to_thread(_create_collection, project_id, payload)
    return {"status": "success", "data": data}


def _clear_records(project_id: str, collection_id: str) -> Dict[str, int]:
    with Session(db.engine_telemetry) as session:
        records = session.exec(
            select(CollectionRecord)
            .where(CollectionRecord.collection_id == collection_id)
            .where(CollectionRecord.project_id == project_id)
        ).all()
        files = _delete_snapshot_files(list(records))
        session.exec(
            delete(CollectionRecord)
            .where(CollectionRecord.collection_id == collection_id)
            .where(CollectionRecord.project_id == project_id)
        )
        session.commit()
    return {"deleted_rows": len(records), "deleted_files": files}


def _delete_collection(project_id: str, collection_id: str) -> Dict[str, int]:
    with Session(db.engine) as session:
        coll = _get_collection_or_404(session, project_id, collection_id)
        session.delete(coll)
        session.commit()
    result = _clear_records(project_id, collection_id)
    logger.info("Deleted collection %s for project %s (%s)", collection_id, project_id, result)
    return result


@router.delete("/collections/{collection_id}")
async def delete_project_collection(project_id: str, collection_id: str) -> Dict[str, Any]:
    result = await asyncio.to_thread(_delete_collection, project_id, collection_id)
    return {"status": "success", **result}


def _get_records(project_id: str, collection_id: str, limit: int, offset: int) -> Dict[str, Any]:
    with Session(db.engine) as session:
        _get_collection_or_404(session, project_id, collection_id)
    with Session(db.engine_telemetry) as session:
        base = (
            select(CollectionRecord)
            .where(CollectionRecord.collection_id == collection_id)
            .where(CollectionRecord.project_id == project_id)
        )
        total = session.exec(select(func.count()).select_from(base.subquery())).one()
        rows = session.exec(
            base.order_by(CollectionRecord.timestamp.desc()).offset(offset).limit(limit)
        ).all()
    data = [
        {"id": r.id, "timestamp": _iso_utc(r.timestamp), "data": _parse_record_data(r.data_json)}
        for r in rows
    ]
    return {"data": data, "total": total}


@router.get("/collections/{collection_id}/records")
async def get_collection_records(
    project_id: str,
    collection_id: str,
    limit: int = Query(50, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    result = await asyncio.to_thread(_get_records, project_id, collection_id, limit, offset)
    return {"status": "success", **result}


def _clear_collection(project_id: str, collection_id: str) -> Dict[str, int]:
    with Session(db.engine) as session:
        _get_collection_or_404(session, project_id, collection_id)
    return _clear_records(project_id, collection_id)


@router.delete("/collections/{collection_id}/records")
async def clear_collection_records(project_id: str, collection_id: str) -> Dict[str, Any]:
    result = await asyncio.to_thread(_clear_collection, project_id, collection_id)
    return {"status": "success", **result}


# ── Variables ────────────────────────────────────────────────────────────────

def _list_variables(project_id: str) -> List[Dict[str, Any]]:
    # SQLite returns the bare column `value` from the row holding MAX(timestamp),
    # which gives us the latest value per variable in a single indexed pass.
    query = text("""
        SELECT node_id, variable_name, value, MAX(timestamp) AS last_updated,
               MIN(timestamp) AS first_seen, COUNT(id) AS record_count
        FROM custom_metric_log
        WHERE project_id = :project_id
        GROUP BY node_id, variable_name
        ORDER BY variable_name
    """)
    with Session(db.engine_telemetry) as session:
        rows = session.execute(query, {"project_id": project_id}).fetchall()
    return [
        {
            "node_id": r[0],
            "variable_name": r[1],
            "value": r[2],
            "last_updated": _iso_utc(r[3]),
            "first_seen": _iso_utc(r[4]),
            "record_count": r[5],
        }
        for r in rows
    ]


@router.get("/variables")
async def get_project_variables(project_id: str) -> Dict[str, Any]:
    data = await asyncio.to_thread(_list_variables, project_id)
    return {"status": "success", "data": data}


def _variable_history(project_id: str, variable_name: str, node_id: Optional[str], limit: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT id, timestamp, value, node_id FROM custom_metric_log
        WHERE project_id = :project_id AND variable_name = :variable_name
    """
    params: Dict[str, Any] = {"project_id": project_id, "variable_name": variable_name, "limit": limit}
    if node_id:
        sql += " AND node_id = :node_id"
        params["node_id"] = node_id
    sql += " ORDER BY timestamp DESC LIMIT :limit"
    with Session(db.engine_telemetry) as session:
        rows = session.execute(text(sql), params).fetchall()
    return [{"id": r[0], "timestamp": _iso_utc(r[1]), "value": r[2], "node_id": r[3]} for r in rows]


@router.get("/variables/{variable_name}/history")
async def get_project_variable_history(
    project_id: str,
    variable_name: str,
    node_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=5000),
) -> Dict[str, Any]:
    data = await asyncio.to_thread(_variable_history, project_id, variable_name, node_id, limit)
    return {"status": "success", "data": data}


@router.get("/variable-history")
async def get_project_variable_history_query(
    project_id: str,
    variable_name: str = Query(...),
    node_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=5000),
) -> Dict[str, Any]:
    data = await asyncio.to_thread(_variable_history, project_id, variable_name, node_id, limit)
    return {"status": "success", "data": data}


def _delete_variable(project_id: str, variable_name: str, node_id: Optional[str]) -> int:
    where = "project_id = :project_id AND variable_name = :variable_name"
    params: Dict[str, Any] = {"project_id": project_id, "variable_name": variable_name}
    if node_id:
        where += " AND node_id = :node_id"
        params["node_id"] = node_id
    with Session(db.engine_telemetry) as session:
        res = session.execute(text(f"DELETE FROM custom_metric_log WHERE {where}"), params)
        session.execute(text(f"DELETE FROM custom_metric_hourly WHERE {where}"), params)
        session.commit()
    logger.info("Deleted variable '%s' (node=%s) for project %s: %s rows", variable_name, node_id, project_id, res.rowcount)
    return res.rowcount


@router.delete("/variables/{variable_name}")
async def delete_project_variable(project_id: str, variable_name: str, node_id: Optional[str] = None) -> Dict[str, Any]:
    deleted = await asyncio.to_thread(_delete_variable, project_id, variable_name, node_id)
    return {"status": "success", "message": f"Variable '{variable_name}' deleted ({deleted} rows).", "deleted": deleted}


@router.delete("/variable-delete")
async def delete_project_variable_query(
    project_id: str,
    variable_name: str = Query(...),
    node_id: Optional[str] = None,
) -> Dict[str, Any]:
    deleted = await asyncio.to_thread(_delete_variable, project_id, variable_name, node_id)
    return {"status": "success", "message": f"Variable '{variable_name}' deleted ({deleted} rows).", "deleted": deleted}


def _cleanup_variable(project_id: str, variable_name: str, node_id: Optional[str], days: int) -> int:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    sql = "DELETE FROM custom_metric_log WHERE project_id = :project_id AND variable_name = :variable_name AND timestamp < :cutoff"
    params: Dict[str, Any] = {"project_id": project_id, "variable_name": variable_name, "cutoff": cutoff}
    if node_id:
        sql += " AND node_id = :node_id"
        params["node_id"] = node_id
    with Session(db.engine_telemetry) as session:
        res = session.execute(text(sql), params)
        session.commit()
    return res.rowcount


@router.delete("/variables/{variable_name}/cleanup")
async def cleanup_project_variable(
    project_id: str,
    variable_name: str,
    node_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=3650),
) -> Dict[str, Any]:
    deleted = await asyncio.to_thread(_cleanup_variable, project_id, variable_name, node_id, days)
    return {"status": "success", "message": f"Purged data older than {days} days ({deleted} rows).", "deleted": deleted}


@router.delete("/variable-cleanup")
async def cleanup_project_variable_query(
    project_id: str,
    variable_name: str = Query(...),
    node_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=3650),
) -> Dict[str, Any]:
    deleted = await asyncio.to_thread(_cleanup_variable, project_id, variable_name, node_id, days)
    return {"status": "success", "message": f"Purged data older than {days} days ({deleted} rows).", "deleted": deleted}
