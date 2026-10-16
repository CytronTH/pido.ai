#!/bin/bash
# ==============================================================================
# PiDo.AI - Offline Update Package Generator
# Creates a clean, deployment-ready offline update tarball (.tar.gz)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/snapshots"

mkdir -p "$OUTPUT_DIR"

cd "$PROJECT_ROOT"

# Ensure frontend is built so offline machines have ready-to-serve assets
if [ -d "$PROJECT_ROOT/frontend" ]; then
    echo "Building frontend production assets..."
    (cd "$PROJECT_ROOT/frontend" && npm run build)
fi

# Detect version & timestamp
VERSION=$(git describe --tags --always 2>/dev/null || echo "latest")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "dev")
SAFE_BRANCH=$(echo "$BRANCH" | tr '/' '_')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="pido_ai_update_${SAFE_BRANCH}_${VERSION}_${TIMESTAMP}.tar.gz"
OUTPUT_FILE="${OUTPUT_DIR}/${PACKAGE_NAME}"

echo "Creating offline update package: ${PACKAGE_NAME}..."

tar --exclude='.git' \
    --exclude='node_modules' \
    --exclude='venv' \
    --exclude='backend/venv' \
    --exclude='backend/db/*.sqlite*' \
    --exclude='backend/db/node_states.json' \
    --exclude='backend/.env' \
    --exclude='backend/models/*.hef' \
    --exclude='snapshots' \
    --exclude='backups' \
    --exclude='*.log' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    -czf "$OUTPUT_FILE" .

echo "=================================================="
echo "✅ Offline update package created successfully!"
echo "📦 File: $OUTPUT_FILE"
echo "📏 Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "=================================================="
