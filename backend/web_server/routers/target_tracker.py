"""Target Tracker records and comparison router.

Allows users to:
1. List and view counting records/runs per project & node.
2. View detailed timeline history (progress, count, speed) of each record.
3. Compare multiple records side-by-side (numerical KPI table & overlay charts).
4. Start a new run / batch with a specified target count from the dashboard.
5. Stop or delete records.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
import math
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from db.database import db
from db.models import Project, TargetTrackerRecord

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/target_tracker", tags=["target-tracker"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class StartRunPayload(BaseModel):
    node_id: str
    target: int = Field(..., gt=0, description="Target count must be greater than 0")
    name: Optional[str] = Field(default="", description="Optional batch or run name")


class StopRunPayload(BaseModel):
    node_id: str
    record_id: Optional[int] = None


class ComparePayload(BaseModel):
    record_ids: List[int] = Field(..., min_length=1, max_length=10)


def _format_duration(seconds: float) -> str:
    """Format duration in seconds into a human-friendly string (e.g. 2m 15s)."""
    if seconds is None or seconds < 0:
        return "0s"
    sec = int(round(seconds))
    if sec < 60:
        return f"{sec}s"
    mins = sec // 60
    rem_sec = sec % 60
    if mins < 60:
        return f"{mins}m {rem_sec}s" if rem_sec > 0 else f"{mins}m"
    hrs = mins // 60
    rem_mins = mins % 60
    return f"{hrs}h {rem_mins}m"


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/records")
async def get_records(
    project_id: str,
    node_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200)
) -> Dict[str, Any]:
    """List target tracker records for the project, sorted by newest first."""
    def _fetch():
        records = db.get_target_tracker_records(
            project_id=project_id,
            node_id=node_id,
            status=status,
            limit=limit
        )
        items = []
        for r in records:
            history_pts = 0
            try:
                if r.history_json:
                    pts = json.loads(r.history_json)
                    history_pts = len(pts) if isinstance(pts, list) else 0
            except Exception:
                history_pts = 0

            items.append({
                "id": r.id,
                "project_id": r.project_id,
                "node_id": r.node_id,
                "name": r.name,
                "target": r.target,
                "actual": r.actual,
                "over_target": r.over_target,
                "progress_percent": r.progress_percent,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "duration_seconds": r.duration_seconds,
                "duration_formatted": _format_duration(r.duration_seconds),
                "avg_rate_per_minute": r.avg_rate_per_minute,
                "peak_rate_per_minute": r.peak_rate_per_minute,
                "unit": r.unit,
                "points_count": history_pts
            })
        return items

    items = await asyncio.to_thread(_fetch)
    return {"status": "success", "count": len(items), "records": items}


@router.get("/records/{record_id}")
async def get_record_details(project_id: str, record_id: int) -> Dict[str, Any]:
    """Retrieve full details of a specific target tracker record including history."""
    def _fetch():
        record = db.get_target_tracker_record(record_id)
        if not record or record.project_id != project_id:
            return None
        history = []
        try:
            if record.history_json:
                history = json.loads(record.history_json)
        except Exception as e:
            logger.warning(f"Failed to parse history_json for record {record_id}: {e}")

        return {
            "id": record.id,
            "project_id": record.project_id,
            "node_id": record.node_id,
            "name": record.name,
            "target": record.target,
            "actual": record.actual,
            "over_target": record.over_target,
            "progress_percent": record.progress_percent,
            "status": record.status,
            "started_at": record.started_at.isoformat() if record.started_at else None,
            "completed_at": record.completed_at.isoformat() if record.completed_at else None,
            "duration_seconds": record.duration_seconds,
            "duration_formatted": _format_duration(record.duration_seconds),
            "avg_rate_per_minute": record.avg_rate_per_minute,
            "peak_rate_per_minute": record.peak_rate_per_minute,
            "unit": record.unit,
            "history": history
        }

    item = await asyncio.to_thread(_fetch)
    if not item:
        raise HTTPException(status_code=404, detail="Target tracker record not found")
    return {"status": "success", "record": item}


def _get_active_worker(project_id: str):
    """Safely get active worker from main module without circular import."""
    import sys
    for mod_name in ("web_server.main", "main"):
        mod = sys.modules.get(mod_name)
        if mod and hasattr(mod, "active_workers"):
            workers = getattr(mod, "active_workers")
            if isinstance(workers, dict):
                return workers.get(project_id)
    return None


@router.post("/start_run")
async def start_run(project_id: str, payload: StartRunPayload) -> Dict[str, Any]:
    """Start a new counting run/batch with a target count.

    Resets the node's counter, creates a new record in the database,
    and syncs the new target to pipeline_json.
    """
    def _sync_db_target():
        try:
            from sqlmodel import Session, select
            with Session(db.engine) as session:
                project = session.exec(select(Project).where(Project.id == project_id)).first()
                if project and project.pipeline_json:
                    pdata = json.loads(project.pipeline_json)
                    nodes = pdata.get("nodes", [])
                    modified = False
                    for n in nodes:
                        if n.get("id") == payload.node_id:
                            if "data" not in n:
                                n["data"] = {}
                            n["data"]["targetCount"] = payload.target
                            modified = True
                            break
                    if modified:
                        project.pipeline_json = json.dumps(pdata)
                        session.add(project)
                        session.commit()
                        logger.info(f"TargetTracker [{payload.node_id}] target synced to Project [{project_id}] pipeline_json: {payload.target}")
        except Exception as dbe:
            logger.warning(f"Failed to persist TargetTracker target to DB: {dbe}")

    # Synchronize target into pipeline_json
    await asyncio.to_thread(_sync_db_target)

    # Check if AI worker is running and update node
    worker = _get_active_worker(project_id)
    node_obj = None
    if worker and hasattr(worker, 'config') and getattr(worker.config, 'router', None):
        router_obj = worker.config.router
        node_obj = router_obj.nodes.get(payload.node_id)

    def _create_record():
        unit = "items"
        if node_obj and hasattr(node_obj, 'unit_name'):
            unit = getattr(node_obj, 'unit_name', 'items')
        run_name = payload.name.strip() if payload.name else ""
        if not run_name:
            run_count = len(db.get_target_tracker_records(project_id, node_id=payload.node_id, limit=100)) + 1
            run_name = f"Run #{run_count}"

        return db.create_target_tracker_record(
            project_id=project_id,
            node_id=payload.node_id,
            target=payload.target,
            name=run_name,
            unit=unit
        )

    # If node is active in running pipeline
    if node_obj and hasattr(node_obj, 'start_new_record'):
        rec = node_obj.start_new_record(name=payload.name, target=payload.target)
        rec_id = getattr(rec, 'id', None) or getattr(node_obj, 'current_record_id', None)
        rec_name = getattr(rec, 'name', None) or getattr(node_obj, 'current_record_name', payload.name or "Run")
        rec_status = getattr(rec, 'status', "running")
        started_at = getattr(rec, 'started_at', None)
        started_at_str = started_at.isoformat() if hasattr(started_at, 'isoformat') and started_at else datetime.now(timezone.utc).isoformat()

        return {
            "status": "success",
            "message": f"Started new run '{rec_name}' with target {payload.target}",
            "record": {
                "id": rec_id,
                "name": rec_name,
                "target": payload.target,
                "status": rec_status,
                "started_at": started_at_str
            }
        }

    # Worker not active or node doesn't have start_new_record: create record in DB directly
    record = await asyncio.to_thread(_create_record)
    return {
        "status": "success",
        "message": f"Created new target record '{record.name}' with target {payload.target}",
        "record": {
            "id": record.id,
            "name": record.name,
            "target": record.target,
            "status": record.status,
            "started_at": record.started_at.isoformat()
        }
    }


@router.post("/stop_run")
async def stop_run(project_id: str, payload: StopRunPayload) -> Dict[str, Any]:
    """Stop/finalize an active counting run."""
    worker = _get_active_worker(project_id)
    if worker and hasattr(worker, 'config') and getattr(worker.config, 'router', None):
        node = worker.config.router.nodes.get(payload.node_id)
        if node and hasattr(node, '_finalize_current_record'):
            node._finalize_current_record(status="stopped")
            return {"status": "success", "message": "Active run stopped"}

    # If worker is not running, stop in DB if record_id provided
    if payload.record_id:
        def _stop():
            rec = db.get_target_tracker_record(payload.record_id)
            if rec and rec.status == "running":
                now = datetime.now(timezone.utc)
                duration = (now - rec.started_at).total_seconds() if rec.started_at else rec.duration_seconds
                db.update_target_tracker_record(
                    record_id=rec.id,
                    actual=rec.actual,
                    over_target=rec.over_target,
                    progress_percent=rec.progress_percent,
                    status="stopped",
                    duration_seconds=round(duration, 1),
                    avg_rate_per_minute=rec.avg_rate_per_minute,
                    peak_rate_per_minute=rec.peak_rate_per_minute,
                    completed_at=now
                )
        await asyncio.to_thread(_stop)

    return {"status": "success", "message": "Run stopped successfully"}


@router.post("/compare")
async def compare_records(project_id: str, payload: ComparePayload) -> Dict[str, Any]:
    """Compare multiple target tracker records side-by-side.

    Returns:
    - Detailed numerical comparison table
    - Key statistics & best performer highlights
    - Normalized timeline data aligned by relative seconds (T+0s, T+10s...) for overlaid charting
    """
    def _do_compare():
        records_data = []
        for rid in payload.record_ids:
            rec = db.get_target_tracker_record(rid)
            if rec and rec.project_id == project_id:
                history = []
                try:
                    if rec.history_json:
                        history = json.loads(rec.history_json)
                except Exception:
                    history = []
                records_data.append({
                    "id": rec.id,
                    "name": rec.name or f"Run #{rec.id}",
                    "target": rec.target,
                    "actual": rec.actual,
                    "over_target": rec.over_target,
                    "progress_percent": rec.progress_percent,
                    "status": rec.status,
                    "duration_seconds": rec.duration_seconds,
                    "duration_formatted": _format_duration(rec.duration_seconds),
                    "avg_rate_per_minute": rec.avg_rate_per_minute,
                    "peak_rate_per_minute": rec.peak_rate_per_minute,
                    "started_at": rec.started_at.isoformat() if rec.started_at else None,
                    "completed_at": rec.completed_at.isoformat() if rec.completed_at else None,
                    "unit": rec.unit,
                    "history": history
                })

        if not records_data:
            return None

        # 1. Best performer computation
        completed_records = [r for r in records_data if r["status"] == "completed"]
        fastest_record = min(completed_records, key=lambda x: x["duration_seconds"]) if completed_records else None
        highest_rate_record = max(records_data, key=lambda x: x["avg_rate_per_minute"]) if records_data else None
        highest_output_record = max(records_data, key=lambda x: x["actual"]) if records_data else None

        # 2. Build normalized timeline for overlay chart (aligned at T=0s)
        # Determine max duration across all compared records
        max_duration = max((r["duration_seconds"] for r in records_data), default=60.0)
        max_duration = max(30.0, max_duration)

        # Create sample intervals (e.g. every 5s or up to 60 intervals)
        step = max(2.0, round(max_duration / 50.0))
        timeline_steps = [round(i * step, 1) for i in range(int(max_duration / step) + 2)]

        # Prepare normalized points
        normalized_chart = []
        for t_rel in timeline_steps:
            point = {"t_rel": t_rel, "time_label": _format_duration(t_rel)}
            for r in records_data:
                rid = r["id"]
                history = r["history"]
                
                # Interpolate / find closest state in history at or before t_rel
                val_actual = 0
                val_prog = 0.0
                val_rate = 0.0

                if history:
                    # History points have 't_rel' or calculate relative from start
                    pts = [p for p in history if p.get("t_rel", 0) <= t_rel]
                    if pts:
                        closest = pts[-1]
                        val_actual = closest.get("actual", 0)
                        val_prog = closest.get("progress", 0.0)
                        val_rate = closest.get("rate", 0.0)
                    elif t_rel >= r["duration_seconds"]:
                        val_actual = r["actual"]
                        val_prog = r["progress_percent"]
                        val_rate = 0.0

                # Cap progress at end of run
                if t_rel > r["duration_seconds"] and r["status"] != "running":
                    val_actual = r["actual"]
                    val_prog = r["progress_percent"]
                    val_rate = 0.0

                point[f"run_{rid}_actual"] = val_actual
                point[f"run_{rid}_progress"] = val_prog
                point[f"run_{rid}_rate"] = val_rate

            normalized_chart.append(point)

        return {
            "records": records_data,
            "summary": {
                "fastest_id": fastest_record["id"] if fastest_record else None,
                "highest_rate_id": highest_rate_record["id"] if highest_rate_record else None,
                "highest_output_id": highest_output_record["id"] if highest_output_record else None,
            },
            "normalized_chart": normalized_chart
        }

    result = await asyncio.to_thread(_do_compare)
    if not result:
        raise HTTPException(status_code=404, detail="No matching records found for comparison")
    return {"status": "success", **result}


@router.delete("/records/{record_id}")
async def delete_record(project_id: str, record_id: int) -> Dict[str, Any]:
    """Delete a target tracker record."""
    def _delete():
        rec = db.get_target_tracker_record(record_id)
        if not rec or rec.project_id != project_id:
            return False
        return db.delete_target_tracker_record(record_id)

    deleted = await asyncio.to_thread(_delete)
    if not deleted:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"status": "success", "message": f"Record {record_id} deleted"}
