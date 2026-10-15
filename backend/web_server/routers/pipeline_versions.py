"""Pipeline version history & cross-system compatibility.

Every pipeline deployment or manual checkpoint creates an immutable, numbered snapshot
and updates the project's pipeline state. Restoring an old version never deletes history:
it creates a new version that copies the old pipeline and performs compatibility checks
against the project's active dashboard widgets.
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from db.database import db
from db.models import PipelineVersion, Project
from ai_engine.pipeline_settings_differ import diff_pipeline_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/pipeline/versions", tags=["pipeline-versions"])

MAX_VERSIONS_PER_PROJECT = 100
NOTE_MAX_LENGTH = 200


class PipelineVersionCreate(BaseModel):
    note: str = Field(..., min_length=1, max_length=NOTE_MAX_LENGTH)
    pipeline: Dict[str, Any]


class PipelineVersionRestore(BaseModel):
    note: Optional[str] = Field(default=None, max_length=NOTE_MAX_LENGTH)


class CompatibilityWarning(BaseModel):
    widget_id: str
    widget_title: str
    referenced_node_id: str
    message: str


class PipelineVersionSummary(BaseModel):
    id: str
    version_number: int
    note: str
    node_count: int
    edge_count: int
    restored_from_version: Optional[int]
    created_at: datetime
    changes_summary: Optional[Dict[str, Any]] = None


class PipelineVersionDetail(PipelineVersionSummary):
    pipeline: Dict[str, Any]
    changes: Dict[str, Any] = Field(default_factory=dict)


class PipelineRestoreResult(BaseModel):
    version: PipelineVersionDetail
    compatibility_warnings: List[CompatibilityWarning]


def _count_pipeline_elements(pipeline: Dict[str, Any]) -> tuple[int, int]:
    nodes = pipeline.get("nodes", [])
    edges = pipeline.get("edges", [])
    node_count = len(nodes) if isinstance(nodes, list) else 0
    edge_count = len(edges) if isinstance(edges, list) else 0
    return node_count, edge_count


def _parse_changes(v: PipelineVersion) -> Dict[str, Any]:
    if getattr(v, "changes_json", None):
        try:
            return json.loads(v.changes_json)
        except Exception:
            pass
    return {}


def _to_summary(v: PipelineVersion) -> PipelineVersionSummary:
    changes = _parse_changes(v)
    return PipelineVersionSummary(
        id=v.id,
        version_number=v.version_number,
        note=v.note,
        node_count=v.node_count,
        edge_count=v.edge_count,
        restored_from_version=v.restored_from_version,
        created_at=v.created_at,
        changes_summary=changes,
    )


def _to_detail(v: PipelineVersion) -> PipelineVersionDetail:
    try:
        pipeline = json.loads(v.pipeline_json)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Pipeline version %s of project %s has invalid pipeline JSON", v.id, v.project_id)
        pipeline = {"nodes": [], "edges": []}
    changes = _parse_changes(v)
    return PipelineVersionDetail(
        **_to_summary(v).model_dump(),
        pipeline=pipeline,
        changes=changes,
    )


def _get_project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def check_pipeline_dashboard_compatibility(
    pipeline_nodes: List[Dict[str, Any]],
    dashboard_layout_json: str
) -> List[CompatibilityWarning]:
    """Inspects active dashboard widgets and flags any widget whose data source

    references a node ID that is missing from the provided pipeline nodes.
    """
    warnings: List[CompatibilityWarning] = []
    if not dashboard_layout_json:
        return warnings

    try:
        layout_data = json.loads(dashboard_layout_json)
    except (json.JSONDecodeError, TypeError):
        return warnings

    widgets = layout_data.get("lg", [])
    if not isinstance(widgets, list):
        return warnings

    existing_node_ids = {str(n.get("id")) for n in pipeline_nodes if isinstance(n, dict) and "id" in n}

    for item in widgets:
        if not isinstance(item, dict):
            continue
        cfg = item.get("config", {})
        if not isinstance(cfg, dict):
            continue

        widget_id = str(item.get("i", "unknown"))
        widget_title = str(cfg.get("title") or cfg.get("name") or widget_id)

        raw_paths = []
        if cfg.get("dataPath"):
            raw_paths.append(str(cfg["dataPath"]))
        if isinstance(cfg.get("dataPaths"), list):
            raw_paths.extend([str(p) for p in cfg["dataPaths"]])
        if cfg.get("nodeId"):
            raw_paths.append(str(cfg["nodeId"]))

        for path in raw_paths:
            clean_path = path.replace("dashboard.", "")
            root_node_id = clean_path.split(".")[0]

            if root_node_id and root_node_id not in existing_node_ids:
                warnings.append(CompatibilityWarning(
                    widget_id=widget_id,
                    widget_title=widget_title,
                    referenced_node_id=root_node_id,
                    message=f"Widget '{widget_title}' refers to node '{root_node_id}', which is missing in this pipeline version."
                ))

    return warnings


def create_pipeline_version(
    session: Session,
    project: Project,
    pipeline: Dict[str, Any],
    note: str,
    restored_from: Optional[int] = None,
) -> PipelineVersion:
    """Writes the pipeline to the project, computes setting diff against the previous version,

    appends a new version and prunes old ones. Caller commits.
    """
    current_max = session.exec(
        select(func.max(PipelineVersion.version_number)).where(PipelineVersion.project_id == project.id)
    ).one()
    pipeline_str = json.dumps(pipeline)
    node_count, edge_count = _count_pipeline_elements(pipeline)

    # Calculate detailed diff against previous version
    prev_version = session.exec(
        select(PipelineVersion)
        .where(PipelineVersion.project_id == project.id)
        .order_by(PipelineVersion.version_number.desc())
        .limit(1)
    ).first()

    old_nodes = []
    old_edges = []
    if prev_version:
        try:
            prev_p = json.loads(prev_version.pipeline_json)
            old_nodes = prev_p.get("nodes", [])
            old_edges = prev_p.get("edges", [])
        except Exception:
            pass
    elif project.pipeline_json:
        try:
            cur_p = json.loads(project.pipeline_json)
            old_nodes = cur_p.get("nodes", [])
            old_edges = cur_p.get("edges", [])
        except Exception:
            pass

    new_nodes = pipeline.get("nodes", [])
    new_edges = pipeline.get("edges", [])
    diff = diff_pipeline_settings(old_nodes, old_edges, new_nodes, new_edges)
    changes_str = json.dumps(diff)

    version = PipelineVersion(
        project_id=project.id,
        version_number=(current_max or 0) + 1,
        note=note.strip(),
        pipeline_json=pipeline_str,
        node_count=node_count,
        edge_count=edge_count,
        changes_json=changes_str,
        restored_from_version=restored_from,
    )
    session.add(version)

    project.pipeline_json = pipeline_str
    session.add(project)
    session.flush()

    # Retention: keep only newest MAX_VERSIONS_PER_PROJECT
    stale = session.exec(
        select(PipelineVersion)
        .where(PipelineVersion.project_id == project.id)
        .order_by(PipelineVersion.version_number.desc())
        .offset(MAX_VERSIONS_PER_PROJECT)
    ).all()
    for old in stale:
        session.delete(old)

    return version


# --- Sync DB work ---

def _list_versions_sync(project_id: str, limit: int) -> List[PipelineVersionSummary]:
    with Session(db.engine) as session:
        _get_project_or_404(session, project_id)
        rows = session.exec(
            select(PipelineVersion)
            .where(PipelineVersion.project_id == project_id)
            .order_by(PipelineVersion.version_number.desc())
            .limit(limit)
        ).all()
        # Ensure changes_summary is filled even for legacy rows
        summaries = []
        for v in rows:
            if not getattr(v, "changes_json", None) or v.changes_json == "{}":
                # Compute diff on the fly
                prev = session.exec(
                    select(PipelineVersion)
                    .where(PipelineVersion.project_id == project_id, PipelineVersion.version_number < v.version_number)
                    .order_by(PipelineVersion.version_number.desc())
                    .limit(1)
                ).first()
                try:
                    cur_p = json.loads(v.pipeline_json)
                    prev_p = json.loads(prev.pipeline_json) if prev else {"nodes": [], "edges": []}
                    diff = diff_pipeline_settings(
                        prev_p.get("nodes", []), prev_p.get("edges", []),
                        cur_p.get("nodes", []), cur_p.get("edges", [])
                    )
                    v.changes_json = json.dumps(diff)
                    session.add(v)
                    session.commit()
                except Exception:
                    pass
            summaries.append(_to_summary(v))
        return summaries


def _get_version_sync(project_id: str, version_id: str) -> PipelineVersionDetail:
    with Session(db.engine) as session:
        v = session.get(PipelineVersion, version_id)
        if v is None or v.project_id != project_id:
            raise HTTPException(status_code=404, detail="Pipeline version not found")
        return _to_detail(v)


def _get_diff_sync(project_id: str, version_id: str, compare_to_id: Optional[str]) -> Dict[str, Any]:
    with Session(db.engine) as session:
        v = session.get(PipelineVersion, version_id)
        if v is None or v.project_id != project_id:
            raise HTTPException(status_code=404, detail="Pipeline version not found")

        if compare_to_id:
            base_v = session.get(PipelineVersion, compare_to_id)
            if base_v is None or base_v.project_id != project_id:
                raise HTTPException(status_code=404, detail="Base comparison version not found")
        else:
            base_v = session.exec(
                select(PipelineVersion)
                .where(PipelineVersion.project_id == project_id, PipelineVersion.version_number < v.version_number)
                .order_by(PipelineVersion.version_number.desc())
                .limit(1)
            ).first()

        try:
            new_p = json.loads(v.pipeline_json)
            old_p = json.loads(base_v.pipeline_json) if base_v else {"nodes": [], "edges": []}
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to parse version pipeline data")

        diff = diff_pipeline_settings(
            old_p.get("nodes", []), old_p.get("edges", []),
            new_p.get("nodes", []), new_p.get("edges", [])
        )
        diff["version_number"] = v.version_number
        diff["compare_to_version_number"] = base_v.version_number if base_v else None
        return diff


def _check_version_compatibility_sync(project_id: str, version_id: str) -> List[CompatibilityWarning]:
    with Session(db.engine) as session:
        project = _get_project_or_404(session, project_id)
        v = session.get(PipelineVersion, version_id)
        if v is None or v.project_id != project_id:
            raise HTTPException(status_code=404, detail="Pipeline version not found")
        detail = _to_detail(v)
        nodes = detail.pipeline.get("nodes", [])
        return check_pipeline_dashboard_compatibility(nodes, project.dashboard_layout_json)


def _save_version_sync(project_id: str, payload: PipelineVersionCreate) -> PipelineVersionDetail:
    with Session(db.engine) as session:
        project = _get_project_or_404(session, project_id)
        version = create_pipeline_version(session, project, payload.pipeline, payload.note)
        session.commit()
        session.refresh(version)
        logger.info(
            "Saved pipeline v%d for project %s (%d nodes, %d edges)",
            version.version_number, project_id, version.node_count, version.edge_count
        )
        return _to_detail(version)


def _preview_diff_sync(project_id: str, pipeline: Dict[str, Any]) -> Dict[str, Any]:
    with Session(db.engine) as session:
        project = _get_project_or_404(session, project_id)
        latest_v = session.exec(
            select(PipelineVersion)
            .where(PipelineVersion.project_id == project_id)
            .order_by(PipelineVersion.version_number.desc())
            .limit(1)
        ).first()

        old_nodes = []
        old_edges = []
        if latest_v:
            try:
                old_p = json.loads(latest_v.pipeline_json)
                old_nodes = old_p.get("nodes", [])
                old_edges = old_p.get("edges", [])
            except Exception:
                pass
        elif project.pipeline_json:
            try:
                cur_p = json.loads(project.pipeline_json)
                old_nodes = cur_p.get("nodes", [])
                old_edges = cur_p.get("edges", [])
            except Exception:
                pass

        new_nodes = pipeline.get("nodes", [])
        new_edges = pipeline.get("edges", [])
        diff = diff_pipeline_settings(old_nodes, old_edges, new_nodes, new_edges)
        diff["compare_to_version_number"] = latest_v.version_number if latest_v else None
        return diff


def _restore_version_sync(project_id: str, version_id: str, payload: PipelineVersionRestore) -> PipelineRestoreResult:
    with Session(db.engine) as session:
        project = _get_project_or_404(session, project_id)
        source = session.get(PipelineVersion, version_id)
        if source is None or source.project_id != project_id:
            raise HTTPException(status_code=404, detail="Pipeline version not found")

        try:
            pipeline = json.loads(source.pipeline_json)
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(status_code=422, detail="Stored pipeline for this version is corrupted")

        note = (payload.note or "").strip() or f"Restored from v{source.version_number}"
        version = create_pipeline_version(session, project, pipeline, note, restored_from=source.version_number)
        session.commit()
        session.refresh(version)

        nodes = pipeline.get("nodes", [])
        warnings = check_pipeline_dashboard_compatibility(nodes, project.dashboard_layout_json)

        logger.info(
            "Restored pipeline v%d as v%d for project %s (warnings=%d)",
            source.version_number, version.version_number, project_id, len(warnings)
        )
        return PipelineRestoreResult(
            version=_to_detail(version),
            compatibility_warnings=warnings
        )


# --- Routes ---

@router.get("", response_model=List[PipelineVersionSummary])
async def list_versions(project_id: str, limit: int = 50) -> List[PipelineVersionSummary]:
    limit = max(1, min(limit, MAX_VERSIONS_PER_PROJECT))
    return await asyncio.to_thread(_list_versions_sync, project_id, limit)


@router.post("/preview-diff", response_model=Dict[str, Any])
async def preview_diff(project_id: str, pipeline: Dict[str, Any]) -> Dict[str, Any]:
    """Previews the diff of an in-memory pipeline against the latest saved version."""
    return await asyncio.to_thread(_preview_diff_sync, project_id, pipeline)


@router.get("/{version_id}", response_model=PipelineVersionDetail)
async def get_version(project_id: str, version_id: str) -> PipelineVersionDetail:
    return await asyncio.to_thread(_get_version_sync, project_id, version_id)


@router.get("/{version_id}/diff", response_model=Dict[str, Any])
async def get_version_diff(
    project_id: str,
    version_id: str,
    compare_to: Optional[str] = Query(None, description="Optional version ID to compare against")
) -> Dict[str, Any]:
    """Returns detailed setting diff between this version and its predecessor (or compare_to)."""
    return await asyncio.to_thread(_get_diff_sync, project_id, version_id, compare_to)


@router.get("/{version_id}/compatibility", response_model=List[CompatibilityWarning])
async def check_compatibility(project_id: str, version_id: str) -> List[CompatibilityWarning]:
    return await asyncio.to_thread(_check_version_compatibility_sync, project_id, version_id)


@router.post("", response_model=PipelineVersionDetail, status_code=201)
async def save_version(project_id: str, payload: PipelineVersionCreate) -> PipelineVersionDetail:
    if not payload.note.strip():
        raise HTTPException(status_code=422, detail="Version note is required")
    try:
        return await asyncio.to_thread(_save_version_sync, project_id, payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to save pipeline version for project %s", project_id)
        raise HTTPException(status_code=500, detail="Failed to save pipeline version")


@router.post("/{version_id}/restore", response_model=PipelineRestoreResult, status_code=201)
async def restore_version(project_id: str, version_id: str, payload: PipelineVersionRestore) -> PipelineRestoreResult:
    try:
        return await asyncio.to_thread(_restore_version_sync, project_id, version_id, payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to restore pipeline version %s for project %s", version_id, project_id)
        raise HTTPException(status_code=500, detail="Failed to restore pipeline version")
