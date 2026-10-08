#!/bin/bash
# ==============================================================================
#  PiDo.AI - Full Cleanup & Uninstaller
#  Completely removes service, environments, and artifacts for a fresh install test.
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${RED}${BOLD}"
echo "=================================================================="
echo "          🧹 PiDo.AI Cleanup & Uninstall Utility                 "
echo "=================================================================="
echo -e "${NC}"

# Parse flags
CONFIRM_ALL=false
PURGE_REPO=false

for arg in "$@"; do
    case "$arg" in
        -y|--yes)
            CONFIRM_ALL=true
            ;;
        --purge)
            PURGE_REPO=true
            ;;
        -h|--help)
            echo "Usage: ./uninstall.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -y, --yes    Non-interactive mode (auto-confirm all prompts)"
            echo "  --purge      Also delete the entire repository folder (~/pido.ai)"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
    esac
done

if [ "$CONFIRM_ALL" = false ]; then
    echo -e "${YELLOW}This script will stop all PiDo.AI services and clean:${NC}"
    echo "  1. Systemd auto-start service (pido-ai.service)"
    echo "  2. Python virtual environment (backend/venv)"
    echo "  3. Frontend production build and node_modules (frontend/dist)"
    echo "  4. SQLite databases, metrics, and event logs"
    echo "  5. Lingering processes on ports 8000, 8554, 8889"
    if [ "$PURGE_REPO" = true ]; then
        echo -e "  ${RED}6. [PURGE] The entire pido.ai repository folder will be deleted!${NC}"
    fi
    echo ""
    read -rp "Are you sure you want to proceed? (y/N): " response
    case "$response" in
        [yY][eE][sS]|[yY])
            ;;
        *)
            log_info "Cleanup aborted by user."
            exit 0
            ;;
    esac
fi

# ── Step 1: Stop and Remove systemd service ────────────────────────────────────
echo ""
log_info "Step 1/5: Removing systemd service (pido-ai.service)..."
if systemctl list-unit-files | grep -q "pido-ai.service"; then
    sudo systemctl stop pido-ai.service 2>/dev/null || true
    sudo systemctl disable pido-ai.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/pido-ai.service
    sudo systemctl daemon-reload
    sudo systemctl reset-failed 2>/dev/null || true
    log_success "Service pido-ai.service removed."
else
    log_info "No active pido-ai.service found in systemd."
fi

# ── Step 2: Terminate any lingering background processes ──────────────────────
echo ""
log_info "Step 2/5: Terminating background processes & freeing ports..."
pkill -f "uvicorn web_server.main" 2>/dev/null || true
pkill -f "mediamtx" 2>/dev/null || true
pkill -f "ffmpeg.*loop_" 2>/dev/null || true

# Free ports
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 8000/udp 2>/dev/null || true
    fuser -k 8554/tcp 2>/dev/null || true
    fuser -k 8889/tcp 2>/dev/null || true
fi
log_success "Processes terminated and ports cleared."

# ── Step 3: Determine repository root ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
CURRENT_USER=$(id -un)
USER_HOME=$(eval echo "~$CURRENT_USER")

if [ -f "$SCRIPT_DIR/backend/web_server/main.py" ]; then
    TARGET_DIR="$SCRIPT_DIR"
elif [ -d "$USER_HOME/pido.ai" ]; then
    TARGET_DIR="$USER_HOME/pido.ai"
elif [ -d "$USER_HOME/pido-ai" ]; then
    TARGET_DIR="$USER_HOME/pido-ai"
else
    TARGET_DIR=""
fi

# ── Step 4: Clean artifacts, venv, and builds ─────────────────────────────────
echo ""
log_info "Step 3/5: Cleaning virtual environment, builds, and runtime data..."

if [ -n "$TARGET_DIR" ] && [ -d "$TARGET_DIR" ]; then
    # Remove venv
    if [ -d "$TARGET_DIR/backend/venv" ]; then
        log_info "Removing $TARGET_DIR/backend/venv..."
        rm -rf "$TARGET_DIR/backend/venv"
    fi

    # Remove frontend dist and node_modules
    if [ -d "$TARGET_DIR/frontend/dist" ]; then
        log_info "Removing $TARGET_DIR/frontend/dist..."
        rm -rf "$TARGET_DIR/frontend/dist"
    fi
    if [ -d "$TARGET_DIR/frontend/node_modules" ]; then
        log_info "Removing $TARGET_DIR/frontend/node_modules..."
        rm -rf "$TARGET_DIR/frontend/node_modules"
    fi

    # Remove SQLite databases and temporary storage
    log_info "Removing local databases and caches..."
    rm -f "$TARGET_DIR/backend/db/"*.sqlite* 2>/dev/null || true
    rm -rf "$TARGET_DIR/backend/media_server/recordings"/* 2>/dev/null || true
    rm -rf "$TARGET_DIR/snapshots"/* 2>/dev/null || true

    # Clean __pycache__
    find "$TARGET_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    log_success "Workspace artifacts wiped clean."
fi

# ── Step 5: Optional full repository purge ────────────────────────────────────
echo ""
if [ "$PURGE_REPO" = true ]; then
    log_info "Step 4/5: Purging repository directory..."
    if [ -n "$TARGET_DIR" ] && [ -d "$TARGET_DIR" ]; then
        cd "$USER_HOME"
        rm -rf "$TARGET_DIR"
        log_success "Repository directory ($TARGET_DIR) completely removed."
    fi
else
    log_info "Step 4/5: Retaining repository source files (use --purge to delete folder)."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "${GREEN}${BOLD}       ✨ Cleanup Completed Successfully!                         ${NC}"
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo ""
echo -e "You can now test fresh installation using:"
if [ "$PURGE_REPO" = true ]; then
    echo -e "  ${CYAN}curl -sSL https://raw.githubusercontent.com/CytronTH/pido.ai/main/install.sh | bash${NC}"
else
    echo -e "  ${CYAN}cd $TARGET_DIR && ./install.sh${NC}"
    echo -e "or test full one-liner:"
    echo -e "  ${CYAN}curl -sSL https://raw.githubusercontent.com/CytronTH/pido.ai/main/install.sh | bash${NC}"
fi
echo ""
