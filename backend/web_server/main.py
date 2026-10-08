import logging
import asyncio
import json
import yaml
import re
import hashlib
import uuid
import threading
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Union
from .websocket_manager import manager

import sys
from pathlib import Path
# Add backend root to sys.path to easily import ai_engine
sys.path.append(str(Path(__file__).resolve().parent.parent))
from ai_engine.hailo_worker import HailoPipelineWorker
from ai_engine.telemetry_manager import telemetry_mgr
from ai_engine.pipeline_differ import diff_pipelines

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global reference to AI workers, main event loop, and background tasks
active_workers = {}
main_loop = None
background_tasks = set()

import functools
import psutil
import time


def on_metadata_received(project_id, metadata):
    """
    Callback fired by HailoPipelineWorker (which runs in a background thread).
    """
    try:
        if metadata.get("type") == "system" and metadata.get("action") == "restart_worker":
            logger.info(f"Received restart_worker signal for {project_id}. Scheduling restart in 100ms.")
            # Trigger the deploy endpoint to fully restart the engine
            def _trigger_restart():
                import requests
                try:
                    # Fetch current nodes and edges
                    projects = read_projects()
                    target_project = next((p for p in projects if p["id"] == project_id), None)
                    if target_project:
                        pipe = target_project.get("pipeline", {})
                        requests.post(f"http://127.0.0.1:8000/api/pipeline/deploy", json={
                            "project_id": project_id,
                            "nodes": pipe.get("nodes", []),
                            "edges": pipe.get("edges", []),
                            "deploy_mode": "full"
                        })
                except Exception as ex:
                    logger.error(f"Auto-restart failed: {ex}")
                    
            asyncio.get_event_loop().call_later(0.1, lambda: threading.Thread(target=_trigger_restart, daemon=True).start())
            return
            
        # Optimization: Skip scheduling thread-safe tasks if no clients are connected to this project's room
        if not manager.has_clients(project_id):
            return

        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast_json(metadata, project_id), main_loop)
    except Exception as e:
        logger.error(f"Failed to schedule metadata broadcast for {project_id}: {e}")


async def system_monitor_task():
    """Background task to broadcast and periodically log fine-grained system & NPU metrics"""
    logger.info("System monitor task started with fine-grained CPU/NPU telemetry!")
    log_counter = 0
    while True:
        try:
            telemetry = telemetry_mgr.get_full_telemetry()
            await manager.broadcast_json(telemetry, room_id="system")
            
            # Periodically log system metrics to DB (every 10s = 10 cycles of 1s)
            log_counter += 1
            if log_counter >= 10:
                log_counter = 0
                db.log_metric(
                    telemetry["system"]["cpu_percent"],
                    telemetry["system"]["ram_percent"],
                    telemetry["system"]["temp_c"]
                )
        except Exception as e:
            logger.error(f"System monitor error: {e}")
        await asyncio.sleep(1)

async def database_maintenance_task():
    """Background task to periodically prune old logs and snapshots (every 24 hours)."""
    await asyncio.sleep(60)  # Wait 1 minute after startup
    while True:
        try:
            logger.info("Running automatic database maintenance & log pruning...")
            res = db.purge_old_logs(days=30, max_records=500000, delete_files=True)
            logger.info(f"Database maintenance completed: {res}")
        except Exception as e:
            logger.error(f"Database maintenance error: {e}")
        await asyncio.sleep(86400)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Application Startup ---
    global active_workers, main_loop
    main_loop = asyncio.get_running_loop()
    
    logger.info("Initializing System Monitor and active projects...")
    
    # Start the system monitor
    sys_task = asyncio.create_task(system_monitor_task())
    background_tasks.add(sys_task)
    sys_task.add_done_callback(background_tasks.discard)

    # Start the periodic DB maintenance task
    maint_task = asyncio.create_task(database_maintenance_task())
    background_tasks.add(maint_task)
    maint_task.add_done_callback(background_tasks.discard)
    
    # Define absolute paths
    base_dir = Path(__file__).resolve().parent.parent
    
    # Auto-resume previously running projects
    projects = read_projects()
    for p in projects:
        if p.get("is_running", False):
            logger.info(f"Restoring project {p['id']} state (Auto-starting)")
            try:
                payload = PipelinePayload(
                    project_id=p["id"],
                    nodes=p.get("pipeline", {}).get("nodes", []),
                    edges=p.get("pipeline", {}).get("edges", [])
                )
                await deploy_pipeline(payload)
            except Exception as e:
                logger.error(f"Failed to auto-start project {p['id']}: {e}")
    
    yield
    
    # --- Application Shutdown ---
    logger.info("Shutting down AI Pipeline Workers...")
    for worker in active_workers.values():
        worker.stop()
    from media_server.camera_manager import camera_mgr
    camera_mgr.stop_all()
    logger.info("Stopping DatabaseManager...")
    db.stop()

app = FastAPI(
    title="PiDo.AI API",
    description="Backend API and WebSocket server for Edge AI Vision",
    version="1.0.0",
    lifespan=lifespan
)

# Allow CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
snapshots_dir = str(PROJECT_ROOT / "snapshots")
os.makedirs(snapshots_dir, exist_ok=True)
app.mount("/api/snapshots", StaticFiles(directory=snapshots_dir), name="snapshots")

# Frontend production build static assets
frontend_dist = PROJECT_ROOT / "frontend" / "dist"
if frontend_dist.is_dir():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")
    videos_dir = frontend_dist / "videos"
    if videos_dir.is_dir():
        app.mount("/videos", StaticFiles(directory=str(videos_dir)), name="frontend_videos")

from .project_backup import router as project_backup_router
app.include_router(project_backup_router)

from .routers.auth import router as auth_router
from .routers.users import router as users_router
from .routers.dashboard_versions import router as dashboard_versions_router
from .routers.project_data import router as project_data_router
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(dashboard_versions_router)
app.include_router(project_data_router)


@app.get("/", response_model=None)
async def root():
    index_file = frontend_dist / "index.html"
    if frontend_dist.is_dir() and index_file.is_file():
        return FileResponse(str(index_file))
    return {"status": "ok", "message": "PiDo.AI Backend is running."}

@app.get("/api/system/hailo")
async def get_hailo_status() -> Dict[str, Any]:
    """Returns detected Hailo device status (Hailo-8 vs Hailo-8L) and architecture info."""
    from ai_engine.hailo_detector import get_hailo_device_info
    return get_hailo_device_info()

@app.websocket("/ws/metadata/{project_id}")
async def websocket_metadata_endpoint(websocket: WebSocket, project_id: str):
    """
    WebSocket endpoint for Frontend to connect and receive AI Metadata for a specific project.
    """
    await manager.connect(websocket, room_id=project_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id=project_id)
    except Exception as e:
        logger.error(f"WebSocket error in {project_id}: {e}")
        manager.disconnect(websocket, room_id=project_id)

@app.websocket("/ws/system_metrics")
async def websocket_system_endpoint(websocket: WebSocket):
    """WebSocket for global system metrics (CPU, RAM, Temp)."""
    await manager.connect(websocket, room_id="system")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id="system")
    except Exception as e:
        manager.disconnect(websocket, room_id="system")

from pathlib import Path
from ai_engine.pipeline_parser import PipelineParser

import os
from sqlmodel import Session, select
from db.database import db
from db.models import Project, Camera, AIModel, Integration

# --- Entity Management APIs ---

def read_entities():
    with Session(db.engine) as session:
        cameras = [c.model_dump() for c in session.exec(select(Camera)).all()]
        models = []
        for m in session.exec(select(AIModel)).all():
            md = m.model_dump()
            try: md["tags"] = json.loads(md["tags_json"])
            except: md["tags"] = []
            try: md["classes"] = json.loads(md["classes_json"])
            except: md["classes"] = []
            del md["tags_json"]
            del md["classes_json"]
            models.append(md)
        integrations = [i.model_dump() for i in session.exec(select(Integration)).all()]
        return {"cameras": cameras, "models": models, "integrations": integrations, "data_sources": []}

def write_entities(data):
    with Session(db.engine) as session:
        # 1. Cameras: Upsert & delete removed
        incoming_cams = {c["id"]: c for c in data.get("cameras", []) if "id" in c}
        existing_cams = {c.id: c for c in session.exec(select(Camera)).all()}
        from media_server.camera_manager import camera_mgr
        for cid, cam_obj in existing_cams.items():
            if cid not in incoming_cams:
                if camera_mgr.is_active(cid):
                    camera_mgr.release(cid)
                session.delete(cam_obj)
        for cid, c in incoming_cams.items():
            is_enabled_val = c.get("is_enabled", True)
            if cid in existing_cams:
                cam_obj = existing_cams[cid]
                if cam_obj.is_enabled and not is_enabled_val and camera_mgr.is_active(cid):
                    camera_mgr.release(cid)
                cam_obj.name = c["name"]
                cam_obj.type = c.get("type", "")
                cam_obj.path = c.get("path", "")
                cam_obj.is_enabled = is_enabled_val
                session.add(cam_obj)
            else:
                session.add(Camera(
                    id=c["id"],
                    name=c["name"],
                    type=c.get("type", ""),
                    path=c.get("path", ""),
                    is_enabled=is_enabled_val
                ))

        # 2. Models: Upsert & delete removed
        incoming_models = {m["id"]: m for m in data.get("models", []) if "id" in m}
        existing_models = {m.id: m for m in session.exec(select(AIModel)).all()}
        for mid, model_obj in existing_models.items():
            if mid not in incoming_models:
                session.delete(model_obj)
        for mid, m in incoming_models.items():
            tags_str = json.dumps(m.get("tags", []))
            classes_str = json.dumps(m.get("classes", []))
            if mid in existing_models:
                model_obj = existing_models[mid]
                model_obj.name = m["name"]
                model_obj.type = m.get("type", "model")
                model_obj.hardware = m.get("hardware", "")
                model_obj.hef_path = m.get("hef_path", "")
                model_obj.original_filename = m.get("original_filename", getattr(model_obj, "original_filename", "") or "")
                model_obj.file_hash = m.get("file_hash", getattr(model_obj, "file_hash", "") or "")
                model_obj.file_size = m.get("file_size", getattr(model_obj, "file_size", 0) or 0)
                model_obj.version = m.get("version", getattr(model_obj, "version", "v1.0") or "v1.0")
                model_obj.description = m.get("description", getattr(model_obj, "description", "") or "")
                model_obj.so_path = m.get("so_path", "")
                model_obj.task = m.get("task", "")
                model_obj.tags_json = tags_str
                model_obj.classes_json = classes_str
                session.add(model_obj)
            else:
                session.add(AIModel(
                    id=m["id"],
                    name=m["name"],
                    type=m.get("type", "model"),
                    hardware=m.get("hardware", ""),
                    hef_path=m.get("hef_path", ""),
                    original_filename=m.get("original_filename", ""),
                    file_hash=m.get("file_hash", ""),
                    file_size=m.get("file_size", 0),
                    version=m.get("version", "v1.0"),
                    description=m.get("description", ""),
                    so_path=m.get("so_path", ""),
                    task=m.get("task", ""),
                    tags_json=tags_str,
                    classes_json=classes_str
                ))

        # 3. Integrations: Upsert & delete removed
        incoming_integs = {i["id"]: i for i in data.get("integrations", []) if "id" in i}
        existing_integs = {i.id: i for i in session.exec(select(Integration)).all()}
        for iid, integ_obj in existing_integs.items():
            if iid not in incoming_integs:
                session.delete(integ_obj)
        for iid, i in incoming_integs.items():
            if iid in existing_integs:
                integ_obj = existing_integs[iid]
                integ_obj.name = i["name"]
                integ_obj.type = i.get("type", "")
                integ_obj.target = i.get("target", "")
                session.add(integ_obj)
            else:
                session.add(Integration(id=i["id"], name=i["name"], type=i.get("type", ""), target=i.get("target", "")))

        session.commit()

@app.get("/api/entities")
async def get_entities() -> Dict[str, Any]:
    # Ensure every video file on disk is registered as a camera entity before listing
    await asyncio.to_thread(sync_video_entities)
    return read_entities()

@app.post("/api/entities")
async def save_entities(data: Dict[str, Any]):
    write_entities(data)
    return {"status": "success"}


# ── ROI Editor helpers ──────────────────────────────────────────────────────

import subprocess
import tempfile
from fastapi.responses import Response, FileResponse
from fastapi import HTTPException

class CameraTestRequest(BaseModel):
    url: str
    type: str = "rtsp"


class CameraPreviewRequest(BaseModel):
    path: Optional[str] = None
    type: Optional[str] = "rtsp"


@app.post("/api/cameras/test-connection")
async def test_camera_connection(req: CameraTestRequest):
    """
    Test connectivity to a CCTV RTSP stream, local camera device, or video file.
    Uses ffprobe with a strict 5s timeout and returns stream metadata.
    """
    url = req.url.strip()
    cam_type = req.type.lower()

    if not url:
        raise HTTPException(status_code=400, detail="Source URL or path is required")

    def _probe():
        if cam_type == "rtsp" or url.startswith("rtsp://") or url.startswith("rtsps://"):
            cmd = [
                "ffprobe", "-v", "error",
                "-rtsp_transport", "tcp",
                "-rw_timeout", "5000000",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name,width,height,r_frame_rate",
                "-of", "json",
                url
            ]
        elif cam_type == "local":
            cmd = [
                "ffprobe", "-v", "error",
                "-f", "v4l2",
                "-i", url,
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name,width,height,r_frame_rate",
                "-of", "json"
            ]
        else:
            # File
            cmd = [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name,width,height,r_frame_rate",
                "-of", "json",
                url
            ]

        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=8)

    try:
        result = await asyncio.to_thread(_probe)
        if result.returncode != 0:
            err_msg = result.stderr.strip() or "Connection failed"
            return {
                "status": "error",
                "connected": False,
                "message": f"Connection test failed: {err_msg[-200:]}"
            }

        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        if not streams:
            return {
                "status": "error",
                "connected": False,
                "message": "No video stream detected from source."
            }

        vstream = streams[0]
        fps_val = None
        raw_fps = vstream.get("r_frame_rate", "")
        if "/" in raw_fps:
            num, den = raw_fps.split("/", 1)
            fps_val = round(float(num) / float(den), 1) if float(den) else None
        elif raw_fps:
            try:
                fps_val = round(float(raw_fps), 1)
            except ValueError:
                fps_val = None

        return {
            "status": "success",
            "connected": True,
            "details": {
                "codec": vstream.get("codec_name", "unknown"),
                "width": vstream.get("width"),
                "height": vstream.get("height"),
                "fps": fps_val,
                "resolution": f"{vstream.get('width', '?')}x{vstream.get('height', '?')}"
            }
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "connected": False,
            "message": "Connection timed out after 8s. Please verify host, port, credentials, and network reachability."
        }
    except Exception as e:
        logger.error(f"Error testing camera connection: {e}")
        return {
            "status": "error",
            "connected": False,
            "message": str(e)
        }


@app.post("/api/cameras/{camera_id}/preview/start")
async def start_camera_preview(camera_id: str, req: Optional[CameraPreviewRequest] = None):
    """
    Start central ingestion for camera preview via camera_mgr.
    Provides a shared RTSP and WebRTC (WHEP) endpoint for realtime playback.
    """
    from media_server.camera_manager import camera_mgr
    entities = read_entities()
    camera = next((c for c in entities.get("cameras", []) if c.get("id") == camera_id), None)

    if not camera:
        if req and req.path:
            camera = {
                "id": camera_id,
                "type": req.type or "rtsp",
                "path": req.path,
                "name": f"Preview {camera_id}",
                "is_enabled": True
            }
        else:
            raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    try:
        rtsp_url = await asyncio.to_thread(camera_mgr.acquire, camera_id, camera)
        return {
            "status": "success",
            "camera_id": camera_id,
            "rtsp_url": rtsp_url,
            "stream_path": f"shared_{camera_id}"
        }
    except Exception as e:
        logger.error(f"Failed to acquire camera preview for '{camera_id}': {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/cameras/{camera_id}/preview/stop")
async def stop_camera_preview(camera_id: str):
    """
    Release central ingestion reference for camera preview.
    """
    from media_server.camera_manager import camera_mgr
    try:
        await asyncio.to_thread(camera_mgr.release, camera_id)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to release camera preview for '{camera_id}': {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/camera-snapshot")
async def camera_snapshot(
    camera_id: Optional[str] = None,
    path: Optional[str] = None,
    type: Optional[str] = None
):
    """
    Capture a single JPEG frame from a camera/RTSP/file source for thumbnail and preview.
    Uses ffmpeg to grab one frame and returns it as image/jpeg.
    """
    src_type = "local"
    src_path = "/dev/video0"
    active_rtsp = None

    if camera_id:
        entities = read_entities()
        camera = next((c for c in entities.get("cameras", []) if c.get("id") == camera_id), None)
        if not camera:
            enabled_cams = [c for c in entities.get("cameras", []) if c.get("is_enabled", True)]
            if enabled_cams:
                camera = enabled_cams[0]
            elif entities.get("cameras"):
                camera = entities["cameras"][0]
            else:
                raise HTTPException(status_code=404, detail="Camera entity not found")

        if not camera.get("is_enabled", True):
            raise HTTPException(status_code=400, detail=f"Camera '{camera.get('name', camera_id)}' is disabled.")

        src_type = camera.get("type", "local")
        src_path = camera.get("path", "/dev/video0")

        from media_server.camera_manager import camera_mgr
        active_rtsp = camera_mgr.get_rtsp_url(camera.get("id", camera_id))
    elif path:
        src_path = path
        src_type = type or ("rtsp" if path.startswith("rtsp://") or path.startswith("rtsps://") else "local")
    else:
        raise HTTPException(status_code=400, detail="Either camera_id or path is required")

    if active_rtsp:
        input_args = ["-rtsp_transport", "tcp", "-timeout", "5000000", "-i", active_rtsp]
    elif src_type == "local":
        input_args = ["-f", "v4l2", "-i", src_path]
    elif src_type == "rtsp":
        input_args = [
            "-rtsp_transport", "tcp",
            "-timeout", "5000000",
            "-i", src_path,
        ]
    elif src_type == "file":
        input_args = ["-ss", "0", "-i", src_path]
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported source type: {src_type}")

    def _run_snapshot():
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        cmd = [
            "ffmpeg", "-y",
            *input_args,
            "-frames:v", "1",
            "-q:v", "3",          # JPEG quality (2=best, 31=worst)
            "-vf", "scale=1280:-2",  # Resize to max 1280px wide, keep aspect
            tmp_path
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=8
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors="replace")[-400:]
            raise RuntimeError(f"ffmpeg error: {err}")

        with open(tmp_path, "rb") as f:
            jpeg_bytes = f.read()

        import os
        os.unlink(tmp_path)
        return jpeg_bytes

    try:
        jpeg_bytes = await asyncio.to_thread(_run_snapshot)
        return Response(
            content=jpeg_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="ffmpeg timed out capturing frame")
    except Exception as e:
        logger.error(f"Snapshot error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/video-file")
async def serve_video_file(path: str):
    """
    Serve a video file from an absolute path on the server or within VIDEOS_DIR.
    """
    from pathlib import Path as PPath
    entities = read_entities()
    allowed_paths = {c.get("path") for c in entities.get("cameras", []) if c.get("type") == "file"}

    p = PPath(path)
    if not p.is_absolute():
        p = (VIDEOS_DIR / path).resolve()
    else:
        p = p.resolve()

    is_in_videos_dir = False
    try:
        is_in_videos_dir = p.is_relative_to(VIDEOS_DIR.resolve())
    except Exception:
        pass

    if str(p) not in allowed_paths and path not in allowed_paths and not is_in_videos_dir:
        raise HTTPException(status_code=403, detail="File not in allowed camera entities or videos directory")

    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(p), media_type="video/mp4")


import shutil

HAILO_POST_PROCESS_DIR = Path("/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes")

@app.get("/api/so-files")
async def list_so_files():
    """Return list of available Hailo post-process .so files on this device."""
    try:
        if not HAILO_POST_PROCESS_DIR.exists():
            return {"status": "error", "files": [], "message": "TAPPAS post_processes directory not found"}
        so_files = sorted([
            f.name for f in HAILO_POST_PROCESS_DIR.iterdir()
            if f.is_file() and f.suffix == ".so"
        ])
        return {"status": "success", "files": so_files}
    except Exception as e:
        logger.error(f"Failed to list .so files: {e}")
        return {"status": "error", "files": [], "message": str(e)}

@app.get("/api/system/video-devices")
async def list_video_devices():
    """Return list of available video devices on the system."""
    import glob
    try:
        devices = sorted(glob.glob("/dev/video*"))
        return {"status": "success", "devices": devices}
    except Exception as e:
        logger.error(f"Failed to list video devices: {e}")
        return {"status": "error", "devices": [], "message": str(e)}

@app.post("/api/models/upload")
async def upload_model(
    name: str = Form(...),
    task: str = Form(...),
    hef_file: UploadFile = File(...),
    so_name: Optional[str] = Form(None),
    metadata_file: Optional[UploadFile] = File(None),
    version: Optional[str] = Form("v1.0"),
    description: Optional[str] = Form(""),
):
    """
    Upload a custom .hef model and select/assign a post-process .so from those
    installed on this device. Uses unique stored filename and SHA-256 checksum to prevent collisions.
    Optionally accepts a metadata.yaml file to extract class names.
    """
    try:
        # Default .so map if not explicitly chosen
        if not so_name or not so_name.strip():
            so_map = {
                "detection": "libyolo_hailortpp_post.so",
                "classification": "libclassification_post.so",
                "pose": "libyolo_hailortpp_post.so",
                "segmentation": "libyolo_hailortpp_post.so",
            }
            so_name = so_map.get(task, "libyolo_hailortpp_post.so")

        # Validate that the requested .so actually exists on the device if dir exists
        so_full_path = HAILO_POST_PROCESS_DIR / so_name
        if not so_full_path.exists():
            default_fallback = HAILO_POST_PROCESS_DIR / "libyolo_hailortpp_post.so"
            if default_fallback.exists():
                logger.warning(f".so file {so_name} not found, falling back to libyolo_hailortpp_post.so")
                so_name = "libyolo_hailortpp_post.so"
            else:
                return {"status": "error", "message": f".so file not found on device: {so_name}"}

        models_dir = Path(__file__).resolve().parent.parent / "models"
        models_dir.mkdir(exist_ok=True)

        new_model_id = f"model_{int(time.time())}"
        orig_filename = Path(hef_file.filename).name if hef_file.filename else "model.hef"
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", orig_filename)
        unique_stored_name = f"{new_model_id}_{safe_name}"
        hef_dest_path = models_dir / unique_stored_name

        hasher = hashlib.sha256()
        file_size = 0
        with open(hef_dest_path, "wb") as f:
            while chunk := await hef_file.read(65536):
                hasher.update(chunk)
                file_size += len(chunk)
                f.write(chunk)
        file_hash = hasher.hexdigest()

        # Parse class names from metadata.yaml if provided
        classes = []
        if metadata_file and metadata_file.filename:
            try:
                content = await metadata_file.read()
                meta = yaml.safe_load(content)
                if isinstance(meta, dict) and "names" in meta:
                    names = meta["names"]
                    if isinstance(names, dict):
                        # YOLO format: {0: 'cup', 1: 'expire_date'}
                        classes = [names[k] for k in sorted(names.keys())]
                    elif isinstance(names, list):
                        classes = names
                logger.info(f"Parsed {len(classes)} classes from metadata.yaml: {classes}")
            except Exception as e:
                logger.warning(f"Failed to parse metadata.yaml: {e}")

        entities = read_entities()
        if "models" not in entities:
            entities["models"] = []

        model_entry = {
            "id": new_model_id,
            "name": name.strip() if name else safe_name,
            "task": task,
            "hef_path": unique_stored_name,
            "original_filename": orig_filename,
            "file_hash": file_hash,
            "file_size": file_size,
            "version": (version or "v1.0").strip(),
            "description": (description or "").strip(),
            "so_path": so_name,
            "classes": classes
        }
        entities["models"].append(model_entry)
        write_entities(entities)

        logger.info(f"Model successfully uploaded: {name} (ID: {new_model_id}, File: {unique_stored_name}, SHA: {file_hash[:8]})")

        return {
            "status": "success",
            "model_id": new_model_id,
            "classes_found": len(classes),
            "stored_file": unique_stored_name,
            "original_filename": orig_filename,
            "file_hash": file_hash,
            "file_size": file_size,
            "version": model_entry["version"],
            "model": model_entry
        }
    except Exception as e:
        logger.error(f"Failed to upload model: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/models/{model_id}/metadata")
async def upload_model_metadata(model_id: str, metadata_file: UploadFile = File(...)):
    """
    Upload a metadata.yaml file for an existing model to set its class names.
    Parses the 'names' field from Ultralytics YOLO metadata format.
    """
    try:
        content = await metadata_file.read()
        meta = yaml.safe_load(content)
        if not isinstance(meta, dict) or "names" not in meta:
            return {"status": "error", "message": "Invalid metadata.yaml: missing 'names' field"}

        names = meta["names"]
        if isinstance(names, dict):
            classes = [names[k] for k in sorted(names.keys())]
        elif isinstance(names, list):
            classes = names
        else:
            return {"status": "error", "message": "'names' field must be a dict or list"}

        entities = read_entities()
        model = next((m for m in entities.get("models", []) if m["id"] == model_id), None)
        if not model:
            return {"status": "error", "message": f"Model {model_id} not found"}

        model["classes"] = classes
        write_entities(entities)
        logger.info(f"Updated classes for {model_id}: {classes}")
        return {"status": "success", "classes": classes}
    except Exception as e:
        logger.error(f"Failed to parse metadata: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/models/{model_id}/classes")
async def update_model_classes(model_id: str, data: Dict[str, Any]):
    """
    Manually set class names for a model.
    Body: {"classes": ["cup", "expire_date"]}
    """
    try:
        classes = data.get("classes", [])
        if not isinstance(classes, list):
            return {"status": "error", "message": "'classes' must be a list"}

        entities = read_entities()
        model = next((m for m in entities.get("models", []) if m["id"] == model_id), None)
        if not model:
            return {"status": "error", "message": f"Model {model_id} not found"}

        model["classes"] = [c.strip() for c in classes if c.strip()]
        write_entities(entities)
        return {"status": "success", "classes": model["classes"]}
    except Exception as e:
        logger.error(f"Failed to update classes: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/upload-hef")
async def upload_hef_only(
    hef_file: UploadFile = File(...),
    name: str = Form(...),
    task: str = Form("detection"),
    version: Optional[str] = Form("v1.0")
):
    """
    Simplified .hef upload from PiDo Model Studio (local Docker compile).
    Accepts only the .hef file — automatically assigns the correct post-process .so
    based on task type, generates unique stored filename and SHA-256 checksum.
    """
    try:
        models_dir = Path(__file__).resolve().parent.parent / "models"
        models_dir.mkdir(exist_ok=True)

        new_model_id = f"model_{int(time.time())}"
        orig_filename = Path(hef_file.filename).name if hef_file.filename else f"{name}.hef"
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", orig_filename)
        unique_stored_name = f"{new_model_id}_{safe_name}"
        hef_dest_path = models_dir / unique_stored_name

        hasher = hashlib.sha256()
        file_size = 0
        with open(hef_dest_path, "wb") as f:
            while chunk := await hef_file.read(65536):
                hasher.update(chunk)
                file_size += len(chunk)
                f.write(chunk)
        file_hash = hasher.hexdigest()

        # Map task → default post-process shared library
        so_map = {
            "detection": "libyolo_hailortpp_post.so",
            "classification": "libclassification_post.so",
            "pose": "libyolo_hailortpp_post.so",
            "segmentation": "libyolo_hailortpp_post.so",
        }
        default_so = so_map.get(task, "libyolo_hailortpp_post.so")

        entities = read_entities()
        if "models" not in entities:
            entities["models"] = []

        model_entry = {
            "id": new_model_id,
            "name": name,
            "task": task,
            "hef_path": unique_stored_name,
            "original_filename": orig_filename,
            "file_hash": file_hash,
            "file_size": file_size,
            "version": (version or "v1.0").strip(),
            "description": "Uploaded from PiDo Model Studio",
            "so_path": default_so,
            "classes": []
        }
        entities["models"].append(model_entry)
        write_entities(entities)

        logger.info(f"HEF uploaded and registered: {name} (ID: {new_model_id}, File: {unique_stored_name})")
        return {
            "status": "success",
            "model_id": new_model_id,
            "stored_file": unique_stored_name,
            "original_filename": orig_filename,
            "file_hash": file_hash,
            "file_size": file_size,
            "version": model_entry["version"],
            "message": f"Model '{name}' uploaded and registered successfully"
        }
    except Exception as e:
        logger.error(f"Failed to upload HEF: {e}")
        return {"status": "error", "message": str(e)}

# --- Video File Upload APIs ---
VIDEOS_DIR = Path(__file__).resolve().parent.parent / "videos"
VIDEOS_DIR.mkdir(exist_ok=True)
MAX_VIDEO_SIZE = 1 * 1024 * 1024 * 1024  # 1 GB
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mkv", ".mov", ".webm"}


def _new_video_camera_id() -> str:
    """Generate a collision-free ID for a file-type camera entity."""
    return f"cam_file_{uuid.uuid4().hex[:12]}"


# Serializes sync runs: concurrent GET /api/entities + /api/videos calls would
# otherwise both see a file as unregistered and create duplicate entities.
_video_sync_lock = threading.Lock()


def _find_video_camera_id(path: Path) -> Optional[str]:
    """Return the ID of the file-type camera entity registered for ``path``."""
    with Session(db.engine) as session:
        cam = session.exec(
            select(Camera).where(Camera.type == "file", Camera.path == str(path))
        ).first()
        return cam.id if cam else None


def sync_video_entities() -> int:
    """
    Reconcile video files in VIDEOS_DIR with file-type Camera entities.

    - Registers any video file on disk that has no matching camera entity.
    - Re-points file entities whose path no longer exists (e.g. after the project
      directory was moved/renamed) to the file of the same name in VIDEOS_DIR.

    Returns the number of entities created or updated.
    """
    try:
        disk_files: Dict[str, Path] = {
            f.name: f for f in VIDEOS_DIR.iterdir()
            if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXTENSIONS
        }
    except OSError as e:
        logger.error(f"Video sync: cannot list videos dir {VIDEOS_DIR}: {e}")
        return 0

    changed = 0
    with _video_sync_lock, Session(db.engine) as session:
        file_cams = session.exec(select(Camera).where(Camera.type == "file")).all()
        registered_paths = {c.path for c in file_cams}

        # 1. Repair stale paths (file moved into the current VIDEOS_DIR)
        for cam in file_cams:
            if cam.path and not Path(cam.path).exists():
                candidate = disk_files.get(Path(cam.path).name)
                if candidate and str(candidate) not in registered_paths:
                    logger.info(f"Video sync: re-pointing camera '{cam.id}' from {cam.path} to {candidate}")
                    registered_paths.discard(cam.path)
                    cam.path = str(candidate)
                    registered_paths.add(cam.path)
                    session.add(cam)
                    changed += 1

        # 2. Register unregistered files
        for name, f in sorted(disk_files.items()):
            if str(f) not in registered_paths:
                cam_id = _new_video_camera_id()
                logger.info(f"Video sync: registering '{name}' as camera '{cam_id}'")
                session.add(Camera(id=cam_id, name=name, type="file", path=str(f), is_enabled=True))
                registered_paths.add(str(f))
                changed += 1

        if changed:
            session.commit()
    return changed


@app.post("/api/videos/upload")
async def upload_video(video_file: UploadFile = File(...)):
    try:
        suffix = Path(video_file.filename).suffix.lower()
        if suffix not in ALLOWED_VIDEO_EXTENSIONS:
            return {"status": "error", "message": f"Unsupported format. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"}
        
        # Strip any directory components to prevent path traversal (e.g. "../../x.mp4")
        safe_name = Path(video_file.filename).name
        save_path = VIDEOS_DIR / safe_name
        # Write to a hidden .part file first so the entity sync never registers a
        # half-written or rejected (oversized) upload.
        tmp_path = VIDEOS_DIR / f".{safe_name}.part"
        size = 0
        with open(tmp_path, "wb") as f:
            while chunk := await video_file.read(1024 * 1024):  # 1MB chunks
                size += len(chunk)
                if size > MAX_VIDEO_SIZE:
                    f.close()
                    tmp_path.unlink(missing_ok=True)
                    return {"status": "error", "message": "File exceeds 1GB limit"}
                f.write(chunk)
        tmp_path.replace(save_path)

        # Register via the shared sync path (reuses the existing entity when the
        # same file is re-uploaded, so no duplicates are created).
        await asyncio.to_thread(sync_video_entities)
        new_cam_id = await asyncio.to_thread(_find_video_camera_id, save_path)

        logger.info(f"Video uploaded: {safe_name} ({size} bytes) as camera '{new_cam_id}'")
        return {"status": "success", "camera_id": new_cam_id, "filename": safe_name, "size_bytes": size}
    except Exception as e:
        logger.error(f"Failed to upload video: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/videos")
async def list_videos():
    try:
        await asyncio.to_thread(sync_video_entities)
        files = []
        for f in VIDEOS_DIR.iterdir():
            if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXTENSIONS:
                files.append({"filename": f.name, "size_bytes": f.stat().st_size, "path": str(f)})
        return {"status": "success", "files": files}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/api/videos/{filename}")
async def delete_video(filename: str):
    try:
        file_path = VIDEOS_DIR / filename
        if not file_path.exists() or not file_path.is_file():
            return {"status": "error", "message": "File not found"}
        file_path.unlink()
        # Remove matching camera entity
        entities = read_entities()
        entities["cameras"] = [c for c in entities.get("cameras", []) if c.get("path") != str(file_path)]
        write_entities(entities)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/data-sources")
async def get_data_sources(project_id: str = None):
    if not project_id:
        return []
        
    projects = read_projects()
    project = next((p for p in projects if p.get("id") == project_id), None)
    
    if project and "exposed_data_sources" in project:
        return project["exposed_data_sources"]
        
    return []

# --- Project Management APIs ---
def read_projects():
    with Session(db.engine) as session:
        projects = []
        for p in session.exec(select(Project)).all():
            pd = p.model_dump()
            try: pd["pipeline"] = json.loads(pd["pipeline_json"])
            except: pd["pipeline"] = {"nodes": [], "edges": []}
            try: pd["dashboard_layout"] = json.loads(pd["dashboard_layout_json"])
            except: pd["dashboard_layout"] = {}
            try: pd["exposed_data_sources"] = json.loads(pd["exposed_data_sources_json"])
            except: pd["exposed_data_sources"] = []
            
            # Keep intended state from DB, but guarantee True if it's actually running
            if pd["id"] in active_workers:
                pd["is_running"] = True
            del pd["pipeline_json"]
            del pd["dashboard_layout_json"]
            del pd["exposed_data_sources_json"]
            projects.append(pd)
        return projects

def write_projects(data):
    with Session(db.engine) as session:
        incoming_projects = {p["id"]: p for p in data if "id" in p}
        existing_projects = {p.id: p for p in session.exec(select(Project)).all()}
        
        # Remove projects no longer in incoming list
        for pid, proj_obj in existing_projects.items():
            if pid not in incoming_projects:
                session.delete(proj_obj)
                
        # Upsert incoming projects
        for pid, p in incoming_projects.items():
            pipe_str = json.dumps(p.get("pipeline", {}))
            dash_str = json.dumps(p.get("dashboard_layout", {}))
            ds_str = json.dumps(p.get("exposed_data_sources", []))
            is_run = p.get("is_running", False)
            now = datetime.now(timezone.utc)
            
            if pid in existing_projects:
                proj_obj = existing_projects[pid]
                proj_obj.name = p["name"]
                proj_obj.description = p.get("description", "")
                proj_obj.pipeline_json = pipe_str
                proj_obj.dashboard_layout_json = dash_str
                proj_obj.exposed_data_sources_json = ds_str
                proj_obj.is_running = is_run
                proj_obj.updated_at = now
                session.add(proj_obj)
            else:
                session.add(Project(
                    id=p["id"],
                    name=p["name"],
                    description=p.get("description", ""),
                    pipeline_json=pipe_str,
                    dashboard_layout_json=dash_str,
                    exposed_data_sources_json=ds_str,
                    is_running=is_run,
                    created_at=now,
                    updated_at=now
                ))
        session.commit()

@app.get("/api/projects")
async def get_projects():
    return read_projects()

@app.post("/api/projects")
async def save_projects(data: List[Dict[str, Any]]):
    write_projects(data)
    return {"status": "success"}

# --- Pipeline APIs ---
class PipelinePayload(BaseModel):
    project_id: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    deploy_mode: Optional[str] = "modified_nodes"  # "modified_nodes" | "modified_flows" | "full"

@app.post("/api/wiki/sandbox/deploy")
async def deploy_wiki_sandbox(payload: PipelinePayload):
    project_id = "wiki_sandbox"
    logger.info(f"Received sandbox deployment for Wiki: {len(payload.nodes)} nodes")
    try:
        if project_id in active_workers:
            logger.info("Stopping existing sandbox worker...")
            active_workers[project_id].stop()
            del active_workers[project_id]
        
        parser = PipelineParser(payload.nodes, payload.edges)
        pipeline_def = parser.parse()
        
        worker = HailoPipelineWorker(pipeline_def, project_id=project_id)
        worker.set_metadata_callback(functools.partial(on_metadata_received, project_id))
        worker.start()
        active_workers[project_id] = worker
        
        return {"status": "success", "message": "Sandbox deployed"}
    except Exception as e:
        logger.error(f"Failed to deploy sandbox: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

@app.post("/api/wiki/sandbox/stop")
async def stop_wiki_sandbox():
    project_id = "wiki_sandbox"
    try:
        if project_id in active_workers:
            logger.info("Stopping sandbox worker...")
            active_workers[project_id].stop()
            del active_workers[project_id]
        return {"status": "success", "message": "Sandbox stopped"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/pipeline/deploy")
async def deploy_pipeline(payload: PipelinePayload):
    project_id = payload.project_id
    deploy_mode = payload.deploy_mode or "modified_nodes"
    logger.info(f"Received pipeline deployment for {project_id}: {len(payload.nodes)} nodes (mode: {deploy_mode})")
    
    try:
        import importlib
        import ai_engine.message_router
        import ai_engine.pipeline_parser
        importlib.reload(ai_engine.message_router)
        importlib.reload(ai_engine.pipeline_parser)
        from ai_engine.pipeline_parser import PipelineParser

        base_dir = Path(__file__).resolve().parent.parent
        parser = PipelineParser(base_dir)

        # Check if worker is currently active
        worker = active_workers.get(project_id)
        is_worker_running = worker is not None and getattr(worker, 'is_running', False)

        projects = await asyncio.to_thread(read_projects)
        target_project = next((p for p in projects if p["id"] == project_id), None)
        old_nodes = target_project.get("pipeline", {}).get("nodes", []) if target_project else []
        old_edges = target_project.get("pipeline", {}).get("edges", []) if target_project else []

        if is_worker_running:
            diff = diff_pipelines(old_nodes, old_edges, payload.nodes, payload.edges, requested_mode=deploy_mode)
            logger.info(f"Pipeline deploy diff for {project_id}: action={diff.action}, summary={diff.summary}")

            if diff.action == "none":
                return {
                    "status": "success",
                    "mode": "none",
                    "message": "No changes detected. Pipeline is already up to date.",
                    "details": diff.to_dict()
                }

            if diff.action in ("ai_params_only", "router_only", "hybrid_hot"):
                # ZERO DOWNTIME HOT-UPDATE / HOT-RELOAD
                config = parser.parse({"nodes": payload.nodes, "edges": payload.edges}, project_id=project_id)

                # 1. Update AI dynamic parameters if any
                if diff.ai_param_updates:
                    for ai_node_id, updates in diff.ai_param_updates.items():
                        worker.hot_update_ai_params(ai_node_id, updates)

                # 2. Hot-reload Router if needed
                if diff.action in ("router_only", "hybrid_hot") and config.router:
                    worker.hot_reload_router(config.router)

                # Update database project state
                project_found = False
                for p in projects:
                    if p["id"] == project_id:
                        p["pipeline"] = {"nodes": payload.nodes, "edges": payload.edges}
                        p["exposed_data_sources"] = config.dashboard_nodes
                        p["is_running"] = True
                        project_found = True
                        break
                
                if not project_found:
                    projects.append({
                        "id": project_id,
                        "name": f"Project {project_id[-4:]}",
                        "description": "Auto-created on deploy",
                        "pipeline": {"nodes": payload.nodes, "edges": payload.edges},
                        "exposed_data_sources": config.dashboard_nodes,
                        "is_running": True
                    })

                await asyncio.to_thread(write_projects, projects)

                return {
                    "status": "success",
                    "mode": diff.action,
                    "message": f"Pipeline deployed via {diff.action} (zero video downtime)!",
                    "details": diff.to_dict()
                }

        # Full restart or worker was not currently running
        config = parser.parse({"nodes": payload.nodes, "edges": payload.edges}, project_id=project_id)

        # Stop existing worker for this project if any
        if project_id in active_workers:
            active_workers[project_id].stop()
            
        # Create and start a new worker, passing project_id to the callback
        callback = functools.partial(on_metadata_received, project_id)
        new_worker = HailoPipelineWorker(config=config, metadata_callback=callback, project_id=project_id)
        new_worker.start()
        active_workers[project_id] = new_worker
        
        # Update projects.json with the new pipeline state
        project_found = False
        for p in projects:
            if p["id"] == project_id:
                p["pipeline"] = {"nodes": payload.nodes, "edges": payload.edges}
                p["exposed_data_sources"] = config.dashboard_nodes
                p["is_running"] = True
                project_found = True
                break
        
        if not project_found:
            projects.append({
                "id": project_id,
                "name": f"Project {project_id[-4:]}",
                "description": "Auto-created on deploy",
                "pipeline": {"nodes": payload.nodes, "edges": payload.edges},
                "exposed_data_sources": config.dashboard_nodes,
                "is_running": True
            })

        await asyncio.to_thread(write_projects, projects)
            
        return {
            "status": "success",
            "mode": "full_restart",
            "message": "Pipeline deployed and engine started for project",
            "details": {"action": "full_restart", "summary": "Full engine restart completed."}
        }
    except Exception as e:
        logger.error(f"Failed to deploy pipeline for {project_id}: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

@app.post("/api/pipeline/stop/{project_id}")
async def stop_pipeline(project_id: str):
    is_stopped = False
    if project_id in active_workers:
        active_workers[project_id].stop()
        del active_workers[project_id]
        is_stopped = True
        
    projects = read_projects()
    for p in projects:
        if p["id"] == project_id:
            p["is_running"] = False
            break
    write_projects(projects)

    if is_stopped:
        return {"status": "success", "message": f"Pipeline {project_id} stopped"}
    return {"status": "error", "message": "Pipeline not running"}

@app.get("/api/projects/status")
async def get_projects_status():
    status_dict = {}
    current_time = time.time()
    for pid, worker in active_workers.items():
        if getattr(worker, 'is_running', False):
            start_time = getattr(worker, 'start_time', None)
            uptime = int(current_time - start_time) if start_time else 0
            status_dict[pid] = {
                "status": "running",
                "start_time": start_time,
                "uptime": uptime
            }
        else:
            status_dict[pid] = {"status": "stopped", "start_time": None, "uptime": 0}
    return status_dict

@app.get("/api/telemetry/live")
async def get_live_telemetry():
    """Returns real-time fine-grained CPU/NPU telemetry across Processes, Pipelines, and Nodes."""
    return telemetry_mgr.get_full_telemetry()

@app.post("/api/projects/{project_id}/start")
async def start_project(project_id: str):
    projects = read_projects()
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return {"status": "error", "message": "Project not found"}
    
    pipeline = project.get("pipeline", {"nodes": [], "edges": []})
    
    # We can reuse the deploy_pipeline logic
    payload = PipelinePayload(
        project_id=project_id,
        nodes=pipeline.get("nodes", []),
        edges=pipeline.get("edges", [])
    )
    return await deploy_pipeline(payload)

# --- PiDo Model Studio: Remote ONNX Compilation API ---
@app.post("/api/compile-onnx")
async def compile_onnx(
    onnx_file: UploadFile = File(...),
    model_name: str = Form(...),
    task: str = Form("detection")
):
    """
    Receives an ONNX file from PiDo Model Studio (PC) and compiles it to .hef
    using Hailo Dataflow Compiler installed on this device.
    The compiled model is automatically registered in entities.json.
    """
    import subprocess
    
    base_dir = Path(__file__).resolve().parent.parent
    models_dir = base_dir / "models"
    models_dir.mkdir(exist_ok=True)
    
    # Save the uploaded ONNX
    onnx_path = models_dir / onnx_file.filename
    with open(onnx_path, "wb") as f:
        shutil.copyfileobj(onnx_file.file, f)
    
    hef_path = models_dir / f"{model_name}.hef"
    
    # Use hailo SDK to compile ONNX → HEF
    # This requires hailo_sdk_client (Hailo Dataflow Compiler) installed on the device
    compile_script = f"""
import sys
try:
    from hailo_sdk_client import ClientRunner
    runner = ClientRunner()
    runner.translate_onnx_model(
        '{onnx_path}',
        '{model_name}',
        net_input_shapes=None
    )
    runner.optimize_full_precision(calib_dataset=None)
    runner.compile()
    runner.save_hef('{hef_path}')
    print('COMPILE_SUCCESS')
except ImportError:
    # Fallback: try hailo_model_zoo CLI
    import subprocess
    result = subprocess.run([
        'hailomz', 'compile', '--ckpt', '{onnx_path}',
        '--hw-arch', 'hailo8l', '--output-dir', '{models_dir}'
    ], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode == 0:
        print('COMPILE_SUCCESS')
    else:
        print('COMPILE_FAILED:', result.stderr)
except Exception as e:
    print('COMPILE_FAILED:', str(e))
"""
    
    result = subprocess.run(
        [sys.executable, "-c", compile_script],
        capture_output=True, text=True, timeout=600
    )
    
    combined_output = result.stdout + result.stderr
    
    if "COMPILE_SUCCESS" in combined_output and hef_path.exists():
        # Compute hash and size
        hasher = hashlib.sha256()
        file_size = hef_path.stat().st_size
        with open(hef_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        file_hash = hasher.hexdigest()

        # Auto-register compiled model in entities
        entities = read_entities()
        new_model_id = f"model_{int(time.time())}"
        if "models" not in entities:
            entities["models"] = []
        
        entities["models"].append({
            "id": new_model_id,
            "name": model_name,
            "task": task,
            "hef_path": hef_path.name,
            "original_filename": onnx_file.filename or f"{model_name}.onnx",
            "file_hash": file_hash,
            "file_size": file_size,
            "version": "v1.0",
            "description": "Compiled from ONNX via Hailo DFC",
            "so_path": "libyolo_hailortpp_post.so" if task == "detection" else "libclassification_post.so"
        })
        write_entities(entities)
        
        logger.info(f"Model compiled and registered: {model_name}")
        return {
            "status": "success",
            "message": f"Model '{model_name}' compiled and registered successfully",
            "model_id": new_model_id,
            "hef_path": hef_path.name,
            "file_hash": file_hash,
            "file_size": file_size
        }
    else:
        logger.error(f"Compilation failed: {combined_output}")
        # Clean up failed ONNX
        onnx_path.unlink(missing_ok=True)
        return {
            "status": "error",
            "message": "Hailo compilation failed. Make sure Hailo Dataflow Compiler (hailo_sdk_client) is installed.",
            "log": combined_output[-2000:]  # Last 2000 chars of log
        }

@app.post("/api/system/restart")
async def restart_system():
    logger.warning("System reboot requested via API")
    import os
    os.system("sudo reboot")
    return {"status": "success", "message": "Rebooting..."}

@app.get("/api/logs")
def get_logs(
    limit: int = 100,
    node_id: Optional[str] = None,
    event_type: Optional[str] = None,
    camera_id: Optional[str] = None,
    page: int = 1,
    project_id: Optional[str] = None,
    tag: Optional[str] = None
):
    try:
        from db.database import db
        result = db.get_logs(
            limit=limit,
            node_id=node_id,
            event_type=event_type,
            camera_id=camera_id,
            page=page,
            project_id=project_id,
            tag=tag
        )
        return {"status": "success", **result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/logs/tags")
def get_log_tags(project_id: Optional[str] = None):
    try:
        from db.database import db
        tags = db.get_log_tags(project_id=project_id)
        return {"status": "success", "tags": tags}
    except Exception as e:
        return {"status": "error", "message": str(e), "tags": []}

# --- Analytics & Historical Reports APIs ---
from fastapi.responses import Response

@app.get("/api/analytics/counts/history")
def get_counts_history(project_id: str = "default", camera_id: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, interval: str = "hour"):
    try:
        from db.database import db
        result = db.get_class_count_history(
            project_id=project_id,
            camera_id=camera_id,
            start_time=start_time,
            end_time=end_time,
            interval=interval
        )
        return {"status": "success", **result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/analytics/counts/export-csv")
def export_counts_csv(project_id: str = "default", camera_id: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None):
    try:
        from db.database import db
        csv_data = db.export_class_count_csv(
            project_id=project_id,
            camera_id=camera_id,
            start_time=start_time,
            end_time=end_time
        )
        filename = f"class_counts_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        return {"status": "error", "message": str(e)}

class CounterResetPayload(BaseModel):
    project_id: str = "default"
    node_id: Optional[str] = None

@app.post("/api/analytics/counts/reset")
async def reset_counter(payload: CounterResetPayload = CounterResetPayload()):
    try:
        global active_workers
        worker = active_workers.get(payload.project_id)
        if worker and hasattr(worker, 'config') and getattr(worker.config, 'router', None):
            router = worker.config.router
            for nid, node in router.nodes.items():
                if hasattr(node, 'reset_counts'):
                    if payload.node_id is None or payload.node_id == nid:
                        node.reset_counts()
        return {"status": "success", "message": "Counter reset successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ThroughputTogglePayload(BaseModel):
    project_id: str = "default"
    node_id: str
    state: bool

@app.post("/api/analytics/throughput/reset")
async def reset_throughput(payload: CounterResetPayload = CounterResetPayload()):
    try:
        global active_workers
        found = False
        workers = [active_workers[payload.project_id]] if payload.project_id in active_workers else list(active_workers.values())
        for worker in workers:
            if hasattr(worker, 'config') and getattr(worker.config, 'router', None):
                router = worker.config.router
                for nid, node in router.nodes.items():
                    if getattr(node, 'node_type', None) == 'unitThroughputNode' and hasattr(node, 'reset_counts'):
                        if payload.node_id is None or payload.node_id == nid:
                            node.reset_counts()
                            found = True

        # Also reset persisted state in db/node_states.json
        try:
            state_file = Path(__file__).resolve().parent.parent / "db" / "node_states.json"
            if state_file.exists():
                with open(state_file, "r", encoding="utf-8") as f:
                    all_states = json.load(f)
                updated = False
                for k in list(all_states.keys()):
                    if payload.node_id is None or k.endswith(f"_{payload.node_id}") or k == payload.node_id:
                        all_states[k]["current_count"] = 0
                        all_states[k]["accumulated_run_time"] = 0.0
                        all_states[k]["updated_at"] = time.time()
                        updated = True
                if updated:
                    temp_file = state_file.with_suffix(".tmp")
                    with open(temp_file, "w", encoding="utf-8") as f:
                        json.dump(all_states, f, indent=2)
                    temp_file.replace(state_file)
        except Exception as se:
            logger.warning(f"Error resetting persisted state for throughput node {payload.node_id}: {se}")

        return {"status": "success", "message": "Throughput reset successfully", "found": found}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/analytics/throughput/toggle")
async def toggle_throughput(payload: ThroughputTogglePayload):
    try:
        global active_workers
        workers = [active_workers[payload.project_id]] if payload.project_id in active_workers else list(active_workers.values())
        for worker in workers:
            if hasattr(worker, 'config') and getattr(worker.config, 'router', None):
                router = worker.config.router
                node = router.nodes.get(payload.node_id)
                if node and hasattr(node, 'set_manual_state'):
                    node.set_manual_state(payload.state)
                    return {"status": "success", "message": f"Throughput state toggled to {payload.state}"}
        return {"status": "error", "message": "Node not found or unsupported"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class TargetTrackerSetPayload(BaseModel):
    project_id: str = "default"
    node_id: str
    target: int

@app.post("/api/analytics/target_tracker/set")
async def set_target_tracker(payload: TargetTrackerSetPayload):
    try:
        global active_workers
        worker = active_workers.get(payload.project_id)
        if worker and hasattr(worker, 'config') and getattr(worker.config, 'router', None):
            router = worker.config.router
            node = router.nodes.get(payload.node_id)
            if node and hasattr(node, 'target'):
                node.target = payload.target
                
                # Immediately emit update so UI refreshes
                if hasattr(node, 'actual') and hasattr(node, 'is_complete'):
                    if node.actual >= node.target:
                        node.is_complete = True
                    else:
                        node.is_complete = False
                        
                    progress = (node.actual / node.target) * 100.0 if node.target > 0 else 100.0
                    if progress > 100.0: progress = 100.0
                    
                    if router.metadata_callback:
                        router.metadata_callback({
                            "type": "target_tracker_update",
                            "node_id": node.node_id,
                            "target": node.target,
                            "actual": node.actual,
                            "progress_percent": progress,
                            "current_rate_per_minute": getattr(node, 'current_rate_per_minute', 0.0),
                            "eta_seconds": getattr(node, 'eta_seconds', None),
                            "is_complete": node.is_complete
                        })
                return {"status": "success", "message": f"Target updated to {payload.target}"}
        return {"status": "error", "message": "Node not found or unsupported"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- Database Maintenance APIs ---
@app.get("/api/database/stats")
async def get_database_stats(project_id: str = None):
    try:
        from db.database import db
        stats = db.get_db_stats(project_id=project_id)
        return {"status": "success", "data": stats}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class MaintenancePayload(BaseModel):
    days: Optional[int] = 30
    max_records: Optional[int] = 500000
    delete_files: Optional[bool] = True

@app.post("/api/database/maintenance/cleanup")
async def cleanup_database(payload: MaintenancePayload = MaintenancePayload()):
    try:
        from db.database import db
        result = db.purge_old_logs(
            days=payload.days or 30,
            max_records=payload.max_records or 500000,
            delete_files=payload.delete_files if payload.delete_files is not None else True
        )
        return {"status": "success", "result": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/system/shutdown")
async def shutdown_system():
    logger.warning("System shutdown requested via API")
    import os
    os.system("sudo shutdown now")
    return {"status": "success", "message": "Shutting down..."}

# ── Platform Update & Version APIs ──────────────────────────────────────────
import subprocess
import platform

@app.get("/api/system/ping")
def system_ping():
    """Lightweight healthcheck endpoint to verify server availability"""
    return {
        "status": "ok",
        "timestamp": int(time.time()),
        "service": "pido-ai"
    }

@app.get("/api/system/version")
def get_system_version():
    """Return current platform version, git commit, branch and system info"""
    try:
        project_root = Path(__file__).resolve().parent.parent.parent
        try:
            tag = subprocess.check_output(
                ["git", "describe", "--tags", "--always"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
        except:
            tag = "v1.0.0"

        try:
            commit = subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
        except:
            commit = "unknown"

        try:
            branch = subprocess.check_output(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
        except:
            branch = "main"

        try:
            commit_date = subprocess.check_output(
                ["git", "log", "-1", "--format=%cd", "--date=short"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
        except:
            commit_date = ""

        return {
            "status": "success",
            "version": tag,
            "commit": commit,
            "branch": branch,
            "commit_date": commit_date,
            "platform": platform.platform(),
            "python_version": platform.python_version()
        }
    except Exception as e:
        logger.error(f"Error fetching system version: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/system/update/check")
async def check_for_updates(channel: Optional[str] = None) -> Dict[str, Any]:
    """Check remote repository for updates, release tags, and changelog against target channel/branch"""
    try:
        project_root = Path(__file__).resolve().parent.parent.parent
        
        try:
            current_tag = subprocess.check_output(
                ["git", "describe", "--tags", "--always"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
            current_commit = subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
            current_branch = subprocess.check_output(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=str(project_root),
                timeout=3
            ).decode().strip()
        except Exception as e:
            return {"status": "error", "message": f"Failed to get git status: {e}"}

        # Resolve target channel (default to current branch, e.g. dev or main)
        target_branch = channel.strip() if (channel and channel.strip()) else current_branch

        # Fetch remote updates for target branch and tags with 8s timeout
        git_env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
        try:
            subprocess.run(
                ["git", "fetch", "origin", target_branch, "--tags"],
                cwd=str(project_root),
                timeout=8,
                capture_output=True,
                check=False,
                env=git_env
            )
        except subprocess.TimeoutExpired:
            return {
                "status": "offline",
                "message": "Connection timed out. System might be offline or cannot reach remote repository.",
                "current_version": current_tag,
                "current_commit": current_commit,
                "has_update": False,
                "branch": current_branch,
                "target_branch": target_branch,
                "available_channels": [
                    {"id": "main", "name": "Stable (main)", "desc": "Production-ready, tested official releases"},
                    {"id": "dev", "name": "Development (dev)", "desc": "Latest features and rapid updates"}
                ]
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Fetch failed: {e}",
                "current_version": current_tag,
                "current_commit": current_commit,
                "has_update": False,
                "branch": current_branch,
                "target_branch": target_branch,
                "available_channels": [
                    {"id": "main", "name": "Stable (main)", "desc": "Production-ready, tested official releases"},
                    {"id": "dev", "name": "Development (dev)", "desc": "Latest features and rapid updates"}
                ]
            }

        # Check if origin/<target_branch> exists
        has_remote_branch = False
        try:
            subprocess.check_output(
                ["git", "rev-parse", "--verify", f"origin/{target_branch}"],
                cwd=str(project_root),
                timeout=3,
                stderr=subprocess.DEVNULL
            )
            has_remote_branch = True
        except Exception:
            has_remote_branch = False

        behind_count = 0
        if has_remote_branch:
            try:
                behind_output = subprocess.check_output(
                    ["git", "rev-list", "--count", f"HEAD..origin/{target_branch}"],
                    cwd=str(project_root),
                    timeout=5,
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                behind_count = int(behind_output) if behind_output.isdigit() else 0
            except Exception:
                behind_count = 0

        # Latest tag on repository
        try:
            tags_raw = subprocess.check_output(
                ["git", "tag", "-l", "--sort=-version:refname"],
                cwd=str(project_root),
                timeout=5
            ).decode().split()
            latest_tag = tags_raw[0] if tags_raw else current_tag
        except Exception:
            latest_tag = current_tag

        changelog = []
        if behind_count > 0 and has_remote_branch:
            try:
                lines = subprocess.check_output(
                    ["git", "log", f"HEAD..origin/{target_branch}", "--oneline", "-n", "15"],
                    cwd=str(project_root),
                    timeout=5,
                    stderr=subprocess.DEVNULL
                ).decode().strip().split("\n")
                for line in lines:
                    parts = line.split(" ", 1)
                    if len(parts) == 2:
                        changelog.append({"hash": parts[0], "message": parts[1]})
            except Exception:
                pass

        is_channel_switch = (current_branch != target_branch)
        has_update = (behind_count > 0) or is_channel_switch

        latest_version_label = current_tag
        if has_remote_branch:
            try:
                latest_remote_commit = subprocess.check_output(
                    ["git", "rev-parse", "--short", f"origin/{target_branch}"],
                    cwd=str(project_root),
                    timeout=3
                ).decode().strip()
                latest_version_label = f"{target_branch}@{latest_remote_commit}"
            except Exception:
                latest_version_label = f"{target_branch} (latest)"

        return {
            "status": "success",
            "has_update": has_update,
            "current_version": current_tag,
            "current_commit": current_commit,
            "latest_version": latest_version_label,
            "commits_behind": behind_count,
            "changelog": changelog,
            "branch": current_branch,
            "target_branch": target_branch,
            "is_channel_switch": is_channel_switch,
            "available_channels": [
                {"id": "main", "name": "Stable (main)", "desc": "Production-ready, tested official releases"},
                {"id": "dev", "name": "Development (dev)", "desc": "Latest features and rapid updates"}
            ]
        }
    except Exception as e:
        logger.error(f"Error checking update: {e}")
        return {"status": "error", "message": str(e)}

class UpdateApplyPayload(BaseModel):
    target_version: Optional[str] = None

@app.post("/api/system/update/apply")
async def apply_update(payload: UpdateApplyPayload = UpdateApplyPayload()) -> Dict[str, Any]:
    """Trigger background detached update runner"""
    try:
        lock_file = Path("/tmp/pido_update.lock")
        if lock_file.exists():
            try:
                pid = int(lock_file.read_text().strip())
                if psutil.pid_exists(pid):
                    return {"status": "error", "message": "Another update is already in progress"}
            except:
                pass

        updater_script = Path(__file__).resolve().parent.parent / "scripts" / "updater.sh"
        if not updater_script.exists():
            return {"status": "error", "message": f"Updater script not found at {updater_script}"}

        # Initialize status file
        status_file = Path("/tmp/pido_update_status.json")
        init_status = {
            "status": "running",
            "step": "init",
            "progress": 5,
            "message": "Initializing update process...",
            "timestamp": int(time.time()),
            "logs": ["Update triggered by user via API"]
        }
        status_file.write_text(json.dumps(init_status))

        project_root = Path(__file__).resolve().parent.parent.parent
        target_ver = payload.target_version
        if not target_ver:
            try:
                target_ver = subprocess.check_output(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                    cwd=str(project_root),
                    timeout=3
                ).decode().strip()
            except Exception:
                target_ver = "dev"

        subprocess.Popen(
            ["/bin/bash", str(updater_script), "--mode=online", f"--target-version={target_ver}"],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        return {
            "status": "success",
            "message": "Update process started successfully in background"
        }
    except Exception as e:
        logger.error(f"Error starting update: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/system/update/upload")
async def upload_offline_update(package: UploadFile = File(...)) -> Dict[str, Any]:
    """Accept offline update tarball (.tar.gz) and trigger offline updater"""
    try:
        if not package.filename.endswith((".tar.gz", ".tgz")):
            return {"status": "error", "message": "Invalid file type. Please upload a .tar.gz archive."}

        upload_path = Path("/tmp/pido_offline_update.tar.gz")
        with open(upload_path, "wb") as f:
            while chunk := await package.read(1024 * 1024):  # 1MB chunks
                f.write(chunk)

        updater_script = Path(__file__).resolve().parent.parent / "scripts" / "updater.sh"
        if not updater_script.exists():
            return {"status": "error", "message": "Updater script not found"}

        status_file = Path("/tmp/pido_update_status.json")
        init_status = {
            "status": "running",
            "step": "init",
            "progress": 5,
            "message": "Initializing offline update package...",
            "timestamp": int(time.time()),
            "logs": [f"Package uploaded: {package.filename}"]
        }
        status_file.write_text(json.dumps(init_status))

        subprocess.Popen(
            ["/bin/bash", str(updater_script), "--mode=offline", f"--package-path={str(upload_path)}"],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        return {
            "status": "success",
            "message": f"Offline package {package.filename} uploaded. Applying update..."
        }
    except Exception as e:
        logger.error(f"Error uploading update package: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/system/update/status")
async def get_update_status() -> Dict[str, Any]:
    """Poll update progress, current step, and recent logs"""
    try:
        status_file = Path("/tmp/pido_update_status.json")
        if status_file.exists():
            data = json.loads(status_file.read_text())
            return {"status": "success", "data": data}
        return {
            "status": "success",
            "data": {
                "status": "idle",
                "step": "none",
                "progress": 0,
                "message": "No update currently in progress",
                "logs": []
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/nodes/{node_id}/history")
async def get_node_history(
    node_id: str, 
    limit: int = 300, 
    timeframe_min: Optional[int] = None, 
    aggregate_min: Optional[int] = None,
    agg_func: str = "avg"
):
    """Fetch time-series history for a specific node from telemetry_db"""
    try:
        from db.database import db
        history = db.get_metric_history(
            node_id, 
            limit=limit, 
            timeframe_min=timeframe_min, 
            aggregate_min=aggregate_min,
            agg_func=agg_func
        )
        return {"status": "success", "data": history}
    except Exception as e:
        logger.error(f"Error fetching history for {node_id}: {e}")
        return {"status": "error", "message": str(e)}

@app.delete("/api/projects/{project_id}/logs")
def clear_project_logs_api(project_id: str):
    """Deletes all logs and snapshots for a specific project."""
    try:
        from db.database import db
        result = db.clear_project_logs(project_id=project_id)
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Collections & Variables endpoints live in routers/project_data.py

# ── SPA Frontend Catch-all ───────────────────────────────────────────────────
# If frontend/dist exists, serve SPA routes (React Router HTML5 history mode)
if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
    @app.get("/{full_path:path}", response_model=None)
    async def serve_spa(full_path: str):
        # Exclude API, WebSocket, and docs endpoints from being captured
        if (
            full_path.startswith("api/")
            or full_path.startswith("ws/")
            or full_path in ("docs", "redoc", "openapi.json")
        ):
            raise HTTPException(status_code=404, detail="Not Found")

        target_file = frontend_dist / full_path
        if target_file.is_file():
            return FileResponse(str(target_file))
        return FileResponse(str(frontend_dist / "index.html"))
