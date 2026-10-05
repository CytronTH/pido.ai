"""Dashboard version history.

Every manual dashboard save creates an immutable, numbered snapshot (with a required note)
and updates the project's live layout in the same transaction. Restoring an old version
never deletes history: it creates a new version that copies the old layout.
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from db.database import db
from db.models import DashboardVersion, Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/dashboard/versions", tags=["dashboard-versions"])

MAX_VERSIONS_PER_PROJECT = 100
NOTE_MAX_LENGTH = 200


class VersionCreate(BaseModel):
    note: str = Field(..., min_length=1, max_length=NOTE_MAX_LENGTH)
    layout: Dict[str, Any]


class VersionRestore(BaseModel):
    note: Optional[str] = Field(default=None, max_length=NOTE_MAX_LENGTH)


class VersionSummary(BaseModel):
    id: str
    version_number: int
    note: str
    widget_count: int
    restored_from_version: Optional[int]
    created_at: datetime


class VersionDetail(VersionSummary):
    layout: Dict[str, Any]


def _count_widgets(layout: Dict[str, Any]) -> int:
    lg = layout.get("lg")
    return len(lg) if isinstance(lg, list) else 0


def _to_summary(v: DashboardVersion) -> VersionSummary:
    return VersionSummary(
        id=v.id,
        version_number=v.version_number,
        note=v.note,
        widget_count=v.widget_count,
        restored_from_version=v.restored_from_version,
        created_at=v.created_at,
    )


def _to_detail(v: DashboardVersion) -> VersionDetail:
    try:
        layout = json.loads(v.layout_json)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Dashboard version %s of project %s has invalid layout JSON", v.id, v.project_id)
        layout = {}
    return VersionDetail(**_to_summary(v).model_dump(), layout=layout)


def _get_project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _create_version(
    session: Session,
    project: Project,
    layout: Dict[str, Any],
    note: str,
    restored_from: Optional[int] = None,
) -> DashboardVersion:
    """Write the layout to the project, append a new version and prune old ones. Caller commits."""
    current_max = session.exec(
        select(func.max(DashboardVersion.version_number)).where(DashboardVersion.project_id == project.id)
    ).one()
    layout_str = json.dumps(layout)

    version = DashboardVersion(
        project_id=project.id,
        version_number=(current_max or 0) + 1,
        note=note.strip(),
        layout_json=layout_str,
        widget_count=_count_widgets(layout),
        restored_from_version=restored_from,
    )
    session.add(version)

    project.dashboard_layout_json = layout_str
    session.add(project)
    session.flush()

    # Retention: keep only the newest MAX_VERSIONS_PER_PROJECT snapshots (including the one just added)
    stale = session.exec(
        select(DashboardVersion)
        .where(DashboardVersion.project_id == project.id)
        .order_by(DashboardVersion.version_number.desc())
        .offset(MAX_VERSIONS_PER_PROJECT)
    ).all()
    for old in stale:
        session.delete(old)

    return version


# --- Sync DB work (run in a worker thread so the event loop is never blocked) ---

def _list_versions_sync(project_id: str, limit: int) -> List[VersionSummary]:
    with Session(db.engine) as session:
        _get_project_or_404(session, project_id)
        rows = session.exec(
            select(DashboardVersion)
            .where(DashboardVersion.project_id == project_id)
            .order_by(DashboardVersion.version_number.desc())
            .limit(limit)
        ).all()
        return [_to_summary(v) for v in rows]


def _get_version_sync(project_id: str, version_id: str) -> VersionDetail:
    with Session(db.engine) as session:
        v = session.get(DashboardVersion, version_id)
        if v is None or v.project_id != project_id:
            raise HTTPException(status_code=404, detail="Version not found")
        return _to_detail(v)


def _save_version_sync(project_id: str, payload: VersionCreate) -> VersionDetail:
    with Session(db.engine) as session:
        project = _get_project_or_404(session, project_id)
        version = _create_version(session, project, payload.layout, payload.note)
        session.commit()
        session.refresh(version)
        logger.info("Saved dashboard v%d for project %s (%d widgets)", version.version_number, project_id, version.widget_count)
        return _to_detail(version)


def _restore_version_sync(project_id: str, version_id: str, payload: VersionRestore) -> VersionDetail:
    with Session(db.engine) as session:
        project = _get_project_or_404(session, project_id)
        source = session.get(DashboardVersion, version_id)
        if source is None or source.project_id != project_id:
            raise HTTPException(status_code=404, detail="Version not found")
        try:
            layout = json.loads(source.layout_json)
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(status_code=422, detail="Stored layout for this version is corrupted")

        note = (payload.note or "").strip() or f"Restored from v{source.version_number}"
        version = _create_version(session, project, layout, note, restored_from=source.version_number)
        session.commit()
        session.refresh(version)
        logger.info("Restored dashboard v%d as v%d for project %s", source.version_number, version.version_number, project_id)
        return _to_detail(version)


# --- Routes ---

@router.get("", response_model=List[VersionSummary])
async def list_versions(project_id: str, limit: int = 50) -> List[VersionSummary]:
    limit = max(1, min(limit, MAX_VERSIONS_PER_PROJECT))
    return await asyncio.to_thread(_list_versions_sync, project_id, limit)


@router.get("/{version_id}", response_model=VersionDetail)
async def get_version(project_id: str, version_id: str) -> VersionDetail:
    return await asyncio.to_thread(_get_version_sync, project_id, version_id)


@router.post("", response_model=VersionDetail, status_code=201)
async def save_version(project_id: str, payload: VersionCreate) -> VersionDetail:
    if not payload.note.strip():
        raise HTTPException(status_code=422, detail="Version note is required")
    try:
        return await asyncio.to_thread(_save_version_sync, project_id, payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to save dashboard version for project %s", project_id)
        raise HTTPException(status_code=500, detail="Failed to save dashboard version")


@router.post("/{version_id}/restore", response_model=VersionDetail, status_code=201)
async def restore_version(project_id: str, version_id: str, payload: VersionRestore) -> VersionDetail:
    try:
        return await asyncio.to_thread(_restore_version_sync, project_id, version_id, payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to restore dashboard version %s for project %s", version_id, project_id)
        raise HTTPException(status_code=500, detail="Failed to restore dashboard version")
