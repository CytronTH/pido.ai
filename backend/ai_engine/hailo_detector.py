"""
PiDo.AI Hailo Hardware & Model Architecture Detector
Detects whether the connected Hailo accelerator is Hailo-8 (HAILO8) or Hailo-8L (HAILO8L),
and provides smart model compatibility resolution for .hef files.
"""

import os
import re
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union

logger = logging.getLogger(__name__)

# Cached device info to avoid repeated subprocess calls
_CACHED_DEVICE_INFO: Optional[Dict[str, Any]] = None


def get_hailo_device_info(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Query connected Hailo device information via hailortcli.
    Wrapped in try-except with a strict 2-second timeout.
    """
    global _CACHED_DEVICE_INFO
    if _CACHED_DEVICE_INFO is not None and not force_refresh:
        return _CACHED_DEVICE_INFO

    info: Dict[str, Any] = {
        "detected": False,
        "device_arch": "NONE",
        "board_name": "None",
        "firmware_version": "N/A",
        "device_id": "N/A",
    }

    try:
        res = subprocess.run(
            ["hailortcli", "fw-control", "identify"],
            capture_output=True,
            text=True,
            timeout=2.0,
        )
        if res.returncode == 0:
            info["detected"] = True
            for line in res.stdout.splitlines():
                if ":" in line:
                    key, val = line.split(":", 1)
                    k = key.strip()
                    v = val.strip().replace("\x00", "")
                    if k == "Device Architecture":
                        info["device_arch"] = v.upper()
                    elif k == "Board Name":
                        info["board_name"] = v
                    elif k == "Firmware Version":
                        info["firmware_version"] = v
                    elif k == "Executing on device":
                        info["device_id"] = v

            logger.info(
                f"Hailo hardware detected: {info.get('board_name')} "
                f"(Arch: {info.get('device_arch')}, Device ID: {info.get('device_id')})"
            )
    except FileNotFoundError:
        logger.warning("hailortcli tool not found in PATH.")
    except subprocess.TimeoutExpired:
        logger.warning("hailortcli fw-control identify timed out.")
    except Exception as e:
        logger.warning(f"Failed to identify Hailo hardware: {e}")

    _CACHED_DEVICE_INFO = info
    return info


def get_hailo_arch(force_refresh: bool = False) -> str:
    """
    Returns detected Hailo architecture: 'HAILO8', 'HAILO8L', or 'NONE'.
    """
    info = get_hailo_device_info(force_refresh=force_refresh)
    return str(info.get("device_arch", "NONE"))


def get_hef_arch(hef_path: Union[Path, str]) -> str:
    """
    Determine the target architecture of a compiled .hef file.
    Returns 'HAILO8', 'HAILO8L', or 'UNKNOWN'.
    """
    p = Path(hef_path)
    if not p.is_file():
        return "UNKNOWN"

    try:
        res = subprocess.run(
            ["hailortcli", "parse-hef", str(p)],
            capture_output=True,
            text=True,
            timeout=2.0,
        )
        for line in res.stdout.splitlines():
            if "Architecture HEF was compiled for" in line:
                m = re.search(r"HAILO8L?", line, re.IGNORECASE)
                if m:
                    return m.group(0).upper()
    except Exception as e:
        logger.debug(f"Could not parse HEF architecture for {p.name}: {e}")

    # Fallback to filename heuristic if parsing failed
    name_lower = p.name.lower()
    if "_h8l" in name_lower or "hailo8l" in name_lower:
        return "HAILO8L"
    return "UNKNOWN"


def resolve_compatible_hef(
    requested_path: Optional[Union[str, Path]] = None,
    models_dir: Optional[Path] = None,
) -> Tuple[str, bool, str]:
    """
    Resolve the best matching .hef file for the currently detected Hailo accelerator.
    Handles automatic switching between Hailo-8 and Hailo-8L variants.
    
    Returns:
        (resolved_hef_path, is_compatible, status_message)
    """
    if models_dir is None:
        models_dir = Path(__file__).resolve().parent.parent / "models"

    dev_arch = get_hailo_arch()

    # 1. Fallback default model if none specified or path doesn't exist
    if not requested_path or not os.path.exists(str(requested_path)):
        if dev_arch == "HAILO8L":
            default_h8l = models_dir / "yolov8s_h8l.hef"
            if default_h8l.is_file():
                return (str(default_h8l), True, "Default YOLOv8s for Hailo-8L selected")
        default_h8 = models_dir / "yolov8s.hef"
        if default_h8.is_file():
            return (str(default_h8), dev_arch != "HAILO8L", "Default YOLOv8s selected")
        return ("", False, "No default HEF model found in backend/models")

    target = Path(requested_path)
    hef_arch = get_hef_arch(target)

    # 2. If architectures match or device is unknown, keep requested
    if dev_arch in ("NONE", "UNKNOWN") or hef_arch in ("UNKNOWN", dev_arch):
        return (str(target), True, f"Architecture compatible ({hef_arch})")

    # 3. Handle Mismatch: Try to find sibling variant
    # e.g., Device is HAILO8L, but requested model is yolov8s.hef (HAILO8)
    if dev_arch == "HAILO8L" and hef_arch == "HAILO8":
        stem = target.stem
        # Check if sibling <stem>_h8l.hef exists
        candidate = target.parent / f"{stem}_h8l.hef"
        if candidate.is_file():
            logger.info(f"Auto-swapped model from {target.name} to {candidate.name} for Hailo-8L")
            return (str(candidate), True, f"Auto-switched to Hailo-8L variant ({candidate.name})")

    # e.g., Device is HAILO8, but requested model is yolov8s_h8l.hef (HAILO8L)
    elif dev_arch == "HAILO8" and hef_arch == "HAILO8L":
        stem = target.stem
        if stem.endswith("_h8l"):
            normal_stem = stem[:-4]
            candidate = target.parent / f"{normal_stem}.hef"
            if candidate.is_file():
                logger.info(f"Auto-swapped model from {target.name} to {candidate.name} for Hailo-8")
                return (str(candidate), True, f"Auto-switched to Hailo-8 variant ({candidate.name})")

    msg = f"Architecture mismatch: Model '{target.name}' is compiled for {hef_arch}, but connected hardware is {dev_arch}."
    logger.warning(msg)
    return (str(target), False, msg)
