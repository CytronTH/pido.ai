#!/bin/bash
# ==============================================================================
# PiDo.AI - Production Startup Script
# Runs FastAPI (serving both Backend APIs & Frontend SPA) + MediaMTX
# Memory-optimized for Raspberry Pi without running Node.js dev server.
# ==============================================================================

echo "Starting PiDo.AI in PRODUCTION mode..."
echo "Press Ctrl+C to stop all servers."
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

# ── Resolve directory paths ───────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure frontend production bundle exists
if [ ! -d "$PROJECT_ROOT/frontend/dist" ] || [ ! -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
  echo "Frontend production build not found. Building now..."
  (cd "$PROJECT_ROOT/frontend" && npm run build)
fi

IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "=================================================="
echo "🚀 PiDo.AI is running in Production Mode!"
echo "👉 Local access:   http://localhost:8000"
if [ -n "$IP_ADDR" ]; then
  echo "👉 Network access: http://${IP_ADDR}:8000"
fi
echo "=================================================="
echo ""

# ── Start production services ─────────────────────────────────────────────────
npx concurrently \
  -k \
  --kill-others-on-fail \
  -n "BACKEND,MEDIAMTX" \
  -c "cyan.bold,yellow.bold" \
  "cd '$PROJECT_ROOT/backend' && . venv/bin/activate && uvicorn web_server.main:app --host 0.0.0.0 --port 8000 --no-access-log" \
  "cd '$PROJECT_ROOT/backend/mediamtx' && ./mediamtx"
