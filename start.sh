#!/bin/bash

echo "Starting PiDo.AI (Backend + Frontend)..."
echo "Press Ctrl+C to stop both servers."
echo ""

# ── Kill stale processes from previous unclean shutdowns ──────────────────────
echo "Cleaning up stale processes..."
pkill -f "uvicorn web_server.main" 2>/dev/null || true
pkill -f "mediamtx" 2>/dev/null || true
pkill -f "ffmpeg.*loop_" 2>/dev/null || true
# Free port 8000 if still bound (by any process)
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 8000/udp 2>/dev/null || true
sleep 1
echo "Cleanup done."
echo ""

DEV_MODE=false
for arg in "$@"; do
  if [ "$arg" == "--dev" ]; then
    DEV_MODE=true
  fi
done

# ── Start services ────────────────────────────────────────────────────────────
if [ "$DEV_MODE" = true ]; then
  echo "Mode: DEVELOPMENT (Vite Dev Server + Backend + MediaMTX)"
  echo "Frontend UI: http://localhost:5173"
  echo "Backend API: http://localhost:8000"
  echo ""
  npx concurrently \
    -k \
    --kill-others-on-fail \
    -n "BACKEND,FRONTEND,MEDIAMTX" \
    -c "cyan.bold,green.bold,yellow.bold" \
    "cd backend && . venv/bin/activate && uvicorn web_server.main:app --host 0.0.0.0 --port 8000 --no-access-log" \
    "cd frontend && npm run dev" \
    "cd backend/mediamtx && ./mediamtx"
else
  echo "Mode: PRODUCTION (Single Port Entry via FastAPI + MediaMTX)"
  
  # Ensure frontend production bundle exists
  if [ ! -d "frontend/dist" ] || [ ! -f "frontend/dist/index.html" ]; then
    echo "Frontend build not found. Building now..."
    (cd frontend && npm run build)
  fi

  IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "=================================================="
  echo "🚀 PiDo.AI is running!"
  echo "👉 Local access:   http://localhost:8000"
  if [ -n "$IP_ADDR" ]; then
    echo "👉 Network access: http://${IP_ADDR}:8000"
  fi
  echo "=================================================="
  echo ""

  npx concurrently \
    -k \
    --kill-others-on-fail \
    -n "BACKEND,MEDIAMTX" \
    -c "cyan.bold,yellow.bold" \
    "cd backend && . venv/bin/activate && uvicorn web_server.main:app --host 0.0.0.0 --port 8000 --no-access-log" \
    "cd backend/mediamtx && ./mediamtx"
fi
