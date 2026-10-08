#!/bin/bash

echo "Starting PiDo.AI (Development Mode: Backend + Frontend + MediaMTX)..."
echo "Frontend UI: http://localhost:5173"
echo "Backend API: http://localhost:8000"
echo "Press Ctrl+C to stop all servers."
echo ""

# ── Kill stale processes from previous unclean shutdowns ──────────────────────
echo "Cleaning up stale processes..."
pkill -f "uvicorn web_server.main" 2>/dev/null || true
pkill -f "mediamtx" 2>/dev/null || true
pkill -f "ffmpeg.*loop_" 2>/dev/null || true
# Free ports if still bound (8000 Web, 8554 RTSP, 8889 WebRTC)
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 8000/udp 2>/dev/null || true
fuser -k 8554/tcp 2>/dev/null || true
fuser -k 8889/tcp 2>/dev/null || true
sleep 1
echo "Cleanup done."
echo ""

# ── Start all services ────────────────────────────────────────────────────────
# We use npx concurrently to run processes in parallel.
# It automatically prefixes logs, color-codes them, and kills all when you press Ctrl+C.
npx -y concurrently \
  -k \
  --kill-others-on-fail \
  -n "BACKEND,FRONTEND,MEDIAMTX" \
  -c "cyan.bold,green.bold,yellow.bold" \
  "cd backend && . venv/bin/activate && uvicorn web_server.main:app --host 0.0.0.0 --port 8000 --no-access-log" \
  "cd frontend && npm run dev" \
  "cd backend/mediamtx && ./mediamtx"
