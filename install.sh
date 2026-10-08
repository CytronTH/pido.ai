#!/bin/bash
# ==============================================================================
#  PiDo.AI - Full Automated Installer
#  One-line turnkey setup for Raspberry Pi (Hailo-8L Edge AI Vision Platform)
# ==============================================================================

set -eo pipefail

# ── Colors & Formatting ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${CYAN}${BOLD}"
echo "=================================================================="
echo "         🚀 PiDo.AI Edge Vision Platform Installer               "
echo "=================================================================="
echo -e "${NC}"

# ── Step 0: Determine Installation Directory ──────────────────────────────────
CURRENT_USER=$(id -un)
USER_HOME=$(eval echo "~$CURRENT_USER")

# Check if script is executed inside existing pido-ai repo or piped via curl
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
if [ -f "$SCRIPT_DIR/backend/web_server/main.py" ]; then
    INSTALL_DIR="$SCRIPT_DIR"
    log_info "Installing from existing repository directory: $INSTALL_DIR"
else
    INSTALL_DIR="$USER_HOME/pido.ai"
    log_info "Target installation directory: $INSTALL_DIR"
    if [ ! -d "$INSTALL_DIR" ]; then
        log_info "Cloning PiDo.AI from GitHub (main branch)..."
        git clone https://github.com/CytronTH/pido.ai.git "$INSTALL_DIR"
    else
        log_info "Repository already exists at $INSTALL_DIR, pulling latest code..."
        git -C "$INSTALL_DIR" pull origin main || true
    fi
fi

cd "$INSTALL_DIR"

# ── Step 1: Pre-Flight System Diagnostics ─────────────────────────────────────
echo ""
log_info "Step 1/6: Running Pre-Flight Diagnostics..."

ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        log_warn "Detected x86_64 architecture. Hailo hardware features will run in CPU fallback mode."
    else
        log_error "Unsupported CPU architecture: $ARCH"
        log_error "PiDo.AI and Hailo-8L require a 64-bit operating system (aarch64 / arm64)."
        log_error "Please flash Raspberry Pi OS (64-bit) Bookworm and try again."
        exit 1
    fi
else
    log_success "Architecture verified: 64-bit ($ARCH)"
fi

# Disk Space Check
FREE_MB=$(df -m "$INSTALL_DIR" | awk 'NR==2 {print $4}')
if [ "$FREE_MB" -lt 2000 ]; then
    log_warn "Low disk space: only ${FREE_MB}MB available. At least 2GB is recommended."
else
    log_success "Disk space OK (${FREE_MB}MB available)"
fi

# Hailo Hardware Detection
HAILO_FOUND=false
HAILO_MODEL="Hailo NPU"
if command -v lspci >/dev/null 2>&1; then
    if lspci | grep -qi "hailo"; then
        HAILO_FOUND=true
        if command -v hailortcli >/dev/null 2>&1; then
            ARCH_ID=$(hailortcli fw-control identify 2>/dev/null | grep -i "Device Architecture" | awk -F: '{print $2}' | tr -d ' \r\0' || true)
            if [ "$ARCH_ID" = "HAILO8" ]; then
                HAILO_MODEL="Hailo-8 (26 TOPS)"
            elif [ "$ARCH_ID" = "HAILO8L" ]; then
                HAILO_MODEL="Hailo-8L (13 TOPS)"
            fi
        fi
        log_success "AI Accelerator detected: ${HAILO_MODEL} on PCIe bus!"
    fi
fi

if [ "$HAILO_FOUND" = false ]; then
    log_warn "Hailo PCIe device not detected."
    log_warn "If you have a Hailo-8 or Hailo-8L M.2 HAT connected, ensure PCIe is enabled in /boot/firmware/config.txt:"
    log_warn "  dtparam=pciex1"
    log_warn "  dtparam=pciex1_gen=3"
    log_warn "Installation will continue. You can plug in the HAT and reboot later."
fi

# ── Step 2: System Packages & Dependencies ────────────────────────────────────
echo ""
log_info "Step 2/6: Installing system dependencies via apt..."

# Check sudo availability
if ! sudo -v 2>/dev/null; then
    log_info "Administrator privileges (sudo) required for system package installation."
fi

sudo apt-get update -y

PACKAGES=(
    python3
    python3-pip
    python3-venv
    python3-gi
    python3-gst-1.0
    gir1.2-gstreamer-1.0
    gstreamer1.0-tools
    gstreamer1.0-plugins-base
    gstreamer1.0-plugins-good
    gstreamer1.0-plugins-bad
    gstreamer1.0-plugins-ugly
    gstreamer1.0-libav
    gstreamer1.0-rtsp
    gstreamer1.0-libcamera
    ffmpeg
    v4l-utils
    psmisc
    curl
    git
    python3-opencv
    python3-serial
    python3-yaml
    python3-psutil
)

sudo apt-get install -y "${PACKAGES[@]}"

# If Hailo device is present, install official hailo-all package if not already installed
if [ "$HAILO_FOUND" = true ]; then
    if ! command -v hailortcli >/dev/null 2>&1; then
        log_info "Installing official Hailo driver and runtime suite (hailo-all)..."
        sudo apt-get install -y hailo-all || log_warn "hailo-all package installation skipped (can be installed manually)."
    else
        log_success "HailoRT tools (hailortcli) already installed."
    fi
fi

# ── Step 3: Node.js & npm Setup ───────────────────────────────────────────────
echo ""
log_info "Step 3/6: Checking Node.js environment..."

NEED_NODE_INSTALL=false
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    NEED_NODE_INSTALL=true
else
    NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_warn "Existing Node.js version $(node -v) is older than v18."
        NEED_NODE_INSTALL=true
    fi
fi

if [ "$NEED_NODE_INSTALL" = true ]; then
    log_info "Installing Node.js 20 LTS via official NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
log_success "Node.js verified: $(node -v), npm: $(npm -v)"

# ── Step 4: Frontend Build ────────────────────────────────────────────────────
echo ""
log_info "Step 4/6: Building Frontend Production Bundle..."

cd "$INSTALL_DIR/frontend"
npm install --prefer-offline
npm run build
log_success "Frontend production bundle built successfully at frontend/dist"

# ── Step 5: Backend & Python Virtual Environment ──────────────────────────────
echo ""
log_info "Step 5/6: Setting up Python Backend Virtual Environment..."

cd "$INSTALL_DIR/backend"

# Ensure venv is created with system-site-packages so it accesses 'gi' and 'hailort'
if [ ! -d "venv" ]; then
    python3 -m venv --system-site-packages venv
else
    # Update existing pyvenv.cfg to include system-site-packages
    if grep -q "include-system-site-packages = false" venv/pyvenv.cfg 2>/dev/null; then
        sed -i 's/include-system-site-packages = false/include-system-site-packages = true/' venv/pyvenv.cfg
    fi
fi

# Activate and install requirements
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt
deactivate
log_success "Backend environment configured successfully."

# ── Step 6: Configure Systemd Daemon Service ───────────────────────────────────
echo ""
log_info "Step 6/6: Configuring Auto-Start Service (pido-ai.service)..."

cd "$INSTALL_DIR"
chmod +x start-prod.sh start.sh 2>/dev/null || true

SERVICE_FILE="/etc/systemd/system/pido-ai.service"

sudo bash -c "cat > '$SERVICE_FILE'" <<EOF
[Unit]
Description=PiDo.AI Edge Vision Platform
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/bin/bash $INSTALL_DIR/start-prod.sh
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

log_info "Freeing ports (8000, 8554, 8889)..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 8554/tcp 2>/dev/null || true
fuser -k 8889/tcp 2>/dev/null || true

sudo systemctl daemon-reload
sudo systemctl enable pido-ai.service
sudo systemctl restart pido-ai.service

# Verify service is up
sleep 3
if systemctl is-active --quiet pido-ai.service; then
    log_success "pido-ai.service is running actively!"
else
    log_warn "pido-ai.service started, waiting for services to initialize..."
fi

# ── Finish & Summary Banner ───────────────────────────────────────────────────
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "${GREEN}${BOLD}       🎉 PiDo.AI Installation Completed Successfully!            ${NC}"
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "  ${BOLD}🚀 Platform Status:${NC}  RUNNING (Active background service)"
echo -e "  ${BOLD}🌐 Web Dashboard:${NC}    ${CYAN}http://${IP_ADDR}:8000${NC}"
echo -e "  ${BOLD}🏠 Local Access:${NC}     ${CYAN}http://localhost:8000${NC} (or http://pido-ai.local:8000)"
if [ "$HAILO_FOUND" = true ]; then
    echo -e "  ${BOLD}🧠 AI Accelerator:${NC}   ${GREEN}${HAILO_MODEL} Detected & Active${NC}"
else
    echo -e "  ${BOLD}🧠 AI Accelerator:${NC}   ${YELLOW}Not detected (CPU fallback)${NC}"
fi
echo -e "  ${BOLD}📹 Stream Server:${NC}    MediaMTX (RTSP :8554 / WebRTC :8889)"
echo -e "  ${BOLD}🔄 Auto-Start:${NC}       Enabled (Runs automatically on boot)"
echo ""
echo -e "${BOLD}📌 Management Commands:${NC}"
echo "  - Check status:     sudo systemctl status pido-ai.service"
echo "  - View live logs:   journalctl -u pido-ai.service -f"
echo "  - Restart service:  sudo systemctl restart pido-ai.service"
echo "  - Developer mode:   sudo systemctl stop pido-ai.service && ./start.sh"
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "👉 Open ${CYAN}http://${IP_ADDR}:8000${NC} in your browser to start!"
echo ""
