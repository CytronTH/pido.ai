"""
telemetry_manager.py — Precision Hardware & Resource Profiler for PiDo.AI
Tracks In-Platform vs Out-of-Platform resource consumption,
hardware throttling, temperature, dynamic CPU clock, Swap, Disk/Network I/O,
and hierarchical node telemetry on Raspberry Pi 5 + Hailo-8L.
"""

import os
import re
import time
import psutil
import logging
import threading
import subprocess
from typing import Dict, Any, List, Optional, Set
from collections import deque

logger = logging.getLogger(__name__)


class NodeMetrics:
    """Tracks running telemetry statistics for a specific node in a pipeline."""

    def __init__(self, node_id: str, node_type: str, name: str = "") -> None:
        self.node_id: str = node_id
        self.node_type: str = node_type
        self.name: str = name or node_id
        self.lock: threading.Lock = threading.Lock()

        # Call history in rolling window (up to 60 samples)
        self.exec_times: deque = deque(maxlen=60)      # Wall-clock duration per execution (sec)
        self.cpu_times: deque = deque(maxlen=60)       # Active CPU thread/process duration (sec)
        self.timestamps: deque = deque(maxlen=60)

        # Aggregated telemetry metrics
        self.cpu_percent: float = 0.0
        self.npu_percent: float = 0.0
        self.latency_ms: float = 0.0
        self.cpu_time_ms: float = 0.0
        self.npu_latency_ms: float = 0.0
        self.cpu_postprocess_ms: float = 0.0
        self.fps: float = 0.0
        self.freq_hz: float = 0.0
        self.queue_drop_count: int = 0
        self.last_seen: float = time.time()
        self.extra: Dict[str, Any] = {}

    def record_execution(self, duration_sec: float, cpu_sec: Optional[float] = None) -> None:
        now = time.time()
        with self.lock:
            self.exec_times.append(duration_sec)
            self.cpu_times.append(cpu_sec if cpu_sec is not None else duration_sec)
            self.timestamps.append(now)
            self.last_seen = now

    def record_npu(self, latency_ms: float) -> None:
        now = time.time()
        with self.lock:
            self.npu_latency_ms = round(latency_ms, 2)
            self.exec_times.append(latency_ms / 1000.0)
            self.cpu_times.append(0.0)  # Offloaded to Hailo NPU
            self.timestamps.append(now)
            self.last_seen = now

    def record_gst_metric(
        self,
        latency_ms: Optional[float] = None,
        fps: Optional[float] = None,
        extra: Optional[Dict[str, Any]] = None
    ) -> None:
        with self.lock:
            if latency_ms is not None:
                self.latency_ms = round(latency_ms, 2)
            if fps is not None:
                self.fps = round(fps, 1)
            if extra:
                self.extra.update(extra)
            self.last_seen = time.time()

    def record_queue_drop(self, count: int = 1) -> None:
        with self.lock:
            self.queue_drop_count += count

    def roll_up(self, time_window_sec: float = 1.0, num_cores: int = 4) -> Dict[str, Any]:
        now = time.time()
        with self.lock:
            cutoff = now - time_window_sec
            recent_indices = [i for i, ts in enumerate(self.timestamps) if ts >= cutoff]
            count = len(recent_indices)

            if count > 0:
                recent_exec = [self.exec_times[i] for i in recent_indices]
                recent_cpu = [self.cpu_times[i] for i in recent_indices]

                avg_sec = sum(recent_exec) / count
                total_cpu_sec = sum(recent_cpu)
                freq = count / max(time_window_sec, 0.1)

                if self.node_type == "aiNode":
                    self.fps = round(freq, 1)
                    # NPU % estimation based on duty cycle of inference time * FPS
                    if self.npu_latency_ms > 0 and self.fps > 0:
                        self.npu_percent = round(min(100.0, (self.npu_latency_ms * self.fps) / 10.0), 1)
                    cpu_ms = self.extra.get("cpu_postprocess_ms", 0.0) + self.extra.get("python_probe_ms", 0.0)
                    self.cpu_percent = round(min(100.0, (cpu_ms * self.fps) / (10.0 * num_cores)), 1)
                    self.latency_ms = round(avg_sec * 1000.0, 2)
                elif self.node_type in (
                    "logicNode", "functionNode", "counterNode", "targetTrackerNode",
                    "rateLimitNode", "actionNode", "hardwareOutputNode"
                ):
                    self.freq_hz = round(freq, 1)
                    self.latency_ms = round(avg_sec * 1000.0, 3)
                    self.cpu_time_ms = round((total_cpu_sec / count) * 1000.0, 3)
                    # Actual CPU time divided by window length and cores
                    self.cpu_percent = round(min(100.0, (total_cpu_sec / (time_window_sec * num_cores)) * 100.0), 2)
                elif self.node_type == "inputNode":
                    if self.latency_ms > 0 and self.fps > 0:
                        self.cpu_percent = round(min(100.0, (self.latency_ms * self.fps) / (10.0 * num_cores)), 1)
                elif self.node_type == "dashboardVideoNode":
                    if self.latency_ms > 0 and self.fps > 0:
                        self.cpu_percent = round(min(100.0, (self.latency_ms * self.fps) / (10.0 * num_cores)), 1)
            else:
                # Decay idle metrics after 2.0s of inactivity
                if now - self.last_seen > 2.0:
                    self.fps = 0.0
                    self.freq_hz = 0.0
                    self.cpu_percent = 0.0
                    self.npu_percent = 0.0

            res: Dict[str, Any] = {
                "node_id": self.node_id,
                "node_type": self.node_type,
                "name": self.name,
                "cpu_percent": self.cpu_percent,
                "npu_percent": self.npu_percent,
                "fps": self.fps,
                "latency_ms": self.latency_ms,
                "queue_drops": self.queue_drop_count,
                "last_active": round(now - self.last_seen, 1)
            }
            if self.node_type == "aiNode":
                res["npu_latency_ms"] = self.npu_latency_ms
                res["cpu_postprocess_ms"] = self.extra.get("cpu_postprocess_ms", 0.0)
                res["python_probe_ms"] = self.extra.get("python_probe_ms", 0.0)
                res["model"] = self.extra.get("model", "")
                res["total_latency_ms"] = round(
                    self.npu_latency_ms + self.extra.get("cpu_postprocess_ms", 0.0) + self.extra.get("python_probe_ms", 0.0),
                    2
                )
            elif self.freq_hz > 0 or self.node_type in ("logicNode", "functionNode", "counterNode", "targetTrackerNode"):
                res["freq_hz"] = self.freq_hz
                res["cpu_time_ms"] = self.cpu_time_ms

            if self.extra:
                for k, v in self.extra.items():
                    if k not in res:
                        res[k] = v
            return res


class TelemetryManager:
    """
    Central singleton service collecting high-precision system, process,
    hardware health, and pipeline telemetry on Raspberry Pi 5 + Hailo-8L.
    """
    _instance: Optional["TelemetryManager"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls, *args: Any, **kwargs: Any) -> "TelemetryManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TelemetryManager, cls).__new__(cls)
                cls._instance._init_manager()
            return cls._instance

    def _init_manager(self) -> None:
        self.num_cores: int = os.cpu_count() or 4
        self.lock: threading.Lock = threading.Lock()

        # Registered Pipelines: {project_id: {"name": str, "status": str, "nodes": {node_id: NodeMetrics}}}
        self.pipelines: Dict[str, Dict[str, Any]] = {}

        # Registered Subprocesses: {pid: {"name": str, "pipeline_id": Optional[str], "proc": psutil.Process}}
        self.tracked_processes: Dict[int, Dict[str, Any]] = {}

        # Daemon PIDs
        self.mediamtx_pid: Optional[int] = None
        self.frontend_pid: Optional[int] = None
        self._find_mediamtx_process()
        self._find_frontend_process()

        # Main process
        self.main_proc: psutil.Process = psutil.Process(os.getpid())
        try:
            self.main_proc.cpu_percent(interval=None)
        except Exception:
            pass

        # I/O Counters history for rate calculation
        self._last_disk_io: Optional[Any] = None
        self._last_net_io: Optional[Any] = None
        self._last_io_time: float = time.time()
        self.last_poll_time: float = time.time()

        # Latest cached telemetry snapshot (prevents sampling jitter / race conditions)
        self._latest_telemetry: Dict[str, Any] = {}
        self._stop_sampler: threading.Event = threading.Event()

        # Start dedicated deterministic 1.0 Hz background sampler thread
        self._sampler_thread: threading.Thread = threading.Thread(
            target=self._sampling_worker,
            name="TelemetrySampler",
            daemon=True
        )
        self._sampler_thread.start()

        # Detect connected Hailo NPU device dynamically
        try:
            from ai_engine.hailo_detector import get_hailo_device_info
            hailo_info = get_hailo_device_info()
            board_name = hailo_info.get("board_name") or ("Hailo-8" if hailo_info.get("device_arch") == "HAILO8" else "Hailo-8L")
            device_id = hailo_info.get("device_id")
            self._npu_device_label = f"{board_name} (PCIe {device_id})" if device_id else f"{board_name} NPU"
        except Exception:
            self._npu_device_label = "Hailo NPU (PCIe)"

        logger.info(f"TelemetryManager initialized with dedicated 1Hz Precision Sampler (NPU: {self._npu_device_label}).")

    def _find_mediamtx_process(self) -> None:
        """Locates the MediaMTX daemon process if running."""
        try:
            for p in psutil.process_iter(['pid', 'name']):
                if 'mediamtx' in (p.info.get('name') or '').lower():
                    self.mediamtx_pid = p.info['pid']
                    break
        except Exception as e:
            logger.debug(f"MediaMTX process discovery failed: {e}")

    def _find_frontend_process(self) -> None:
        """Locates the Vite / Frontend dev server process if running."""
        try:
            for p in psutil.process_iter(['pid', 'name']):
                try:
                    name = (p.info.get('name') or '').lower()
                    if 'node' in name or 'vite' in name or 'npm' in name:
                        cmd = " ".join(p.cmdline()).lower()
                        if 'pido-ai/frontend' in cmd or ('vite' in cmd and '--host' in cmd):
                            self.frontend_pid = p.info['pid']
                            break
                        elif 'vite' in cmd or 'npm run dev' in cmd:
                            self.frontend_pid = p.info['pid']
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            logger.debug(f"Frontend process discovery failed: {e}")

    def register_pipeline(self, pipeline_id: str, name: str = "Pipeline") -> None:
        with self.lock:
            if pipeline_id not in self.pipelines:
                self.pipelines[pipeline_id] = {
                    "name": name,
                    "status": "running",
                    "nodes": {},
                    "start_time": time.time()
                }
            else:
                self.pipelines[pipeline_id]["status"] = "running"

    def unregister_pipeline(self, pipeline_id: str) -> None:
        with self.lock:
            if pipeline_id in self.pipelines:
                self.pipelines[pipeline_id]["status"] = "stopped"

    def register_process(self, pipeline_id: Optional[str], name: str, pid: int) -> None:
        with self.lock:
            try:
                proc = psutil.Process(pid)
                proc.cpu_percent(interval=None)
                self.tracked_processes[pid] = {
                    "name": name,
                    "pipeline_id": pipeline_id,
                    "proc": proc
                }
            except Exception as e:
                logger.debug(f"Failed to register process {pid}: {e}")

    def unregister_process(self, pid: int) -> None:
        with self.lock:
            self.tracked_processes.pop(pid, None)

    def _get_node(self, pipeline_id: str, node_id: str, node_type: str, name: str = "") -> NodeMetrics:
        if pipeline_id not in self.pipelines:
            self.register_pipeline(pipeline_id)
        pipe = self.pipelines[pipeline_id]
        if node_id not in pipe["nodes"]:
            pipe["nodes"][node_id] = NodeMetrics(node_id, node_type, name)
        return pipe["nodes"][node_id]

    def record_npu_inference(self, pipeline_id: str, node_id: str, latency_ms: float, model: str = "") -> None:
        node = self._get_node(pipeline_id, node_id, "aiNode")
        node.record_npu(latency_ms)
        if model:
            node.extra["model"] = model

    def record_gstreamer_node_metric(
        self,
        pipeline_id: str,
        node_id: str,
        node_type: str,
        latency_ms: Optional[float] = None,
        fps: Optional[float] = None,
        extra: Optional[Dict[str, Any]] = None
    ) -> None:
        node = self._get_node(pipeline_id, node_id, node_type)
        node.record_gst_metric(latency_ms=latency_ms, fps=fps, extra=extra)

    def record_router_node_execution(
        self,
        pipeline_id: str,
        node_id: str,
        node_type: str,
        duration_sec: float,
        cpu_sec: Optional[float] = None
    ) -> None:
        node = self._get_node(pipeline_id, node_id, node_type)
        node.record_execution(duration_sec, cpu_sec=cpu_sec)

    def record_queue_drop(
        self,
        pipeline_id: str,
        node_id: str,
        node_type: str = "aiNode",
        count: int = 1
    ) -> None:
        node = self._get_node(pipeline_id, node_id, node_type)
        node.record_queue_drop(count)

    # ── Hardware Reading Functions (Raspberry Pi 5) ──────────────────────────

    def _read_cpu_temp(self) -> float:
        """Reads CPU temperature with fallback to vcgencmd."""
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                return round(float(f.read().strip()) / 1000.0, 1)
        except Exception:
            pass

        try:
            p = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True, timeout=1.0)
            m = re.search(r"([\d\.]+)", p.stdout)
            if m:
                return float(m.group(1))
        except Exception:
            pass
        return 0.0

    def _read_cpu_freq_mhz(self) -> float:
        """Reads current dynamic CPU frequency in MHz."""
        try:
            with open("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq", "r") as f:
                return round(int(f.read().strip()) / 1000.0, 1)
        except Exception:
            pass

        try:
            p = subprocess.run(["vcgencmd", "measure_clock", "arm"], capture_output=True, text=True, timeout=1.0)
            m = re.search(r"=(\d+)", p.stdout)
            if m:
                return round(int(m.group(1)) / 1000000.0, 1)
        except Exception:
            pass
        return 0.0

    def _read_core_voltage_v(self) -> float:
        """Reads core voltage via vcgencmd."""
        try:
            p = subprocess.run(["vcgencmd", "measure_volts", "core"], capture_output=True, text=True, timeout=1.0)
            m = re.search(r"([\d\.]+)V", p.stdout)
            if m:
                return float(m.group(1))
        except Exception:
            pass
        return 0.0

    def _read_throttled_status(self) -> Dict[str, Any]:
        """
        Parses Raspberry Pi get_throttled bitflags:
        Bit 0: Under-voltage detected
        Bit 1: Arm frequency capped
        Bit 2: Currently throttled
        Bit 3: Soft temperature limit active
        Bit 16: Under-voltage has occurred
        Bit 17: Arm frequency capped has occurred
        Bit 18: Throttling has occurred
        Bit 19: Soft temperature limit has occurred
        """
        res: Dict[str, Any] = {
            "healthy": True,
            "code": "0x0",
            "under_voltage": False,
            "arm_freq_capped": False,
            "throttled": False,
            "soft_temp_limit": False,
            "has_under_voltage": False,
            "has_arm_freq_capped": False,
            "has_throttled": False,
            "has_soft_temp_limit": False,
            "message": "Optimal (Normal)"
        }
        try:
            p = subprocess.run(["vcgencmd", "get_throttled"], capture_output=True, text=True, timeout=1.0)
            out = p.stdout.strip()
            if "=" in out:
                val = int(out.split("=")[1], 16)
                res["code"] = hex(val)
                res["under_voltage"] = bool(val & 0x1)
                res["arm_freq_capped"] = bool(val & 0x2)
                res["throttled"] = bool(val & 0x4)
                res["soft_temp_limit"] = bool(val & 0x8)
                res["has_under_voltage"] = bool(val & 0x10000)
                res["has_arm_freq_capped"] = bool(val & 0x20000)
                res["has_throttled"] = bool(val & 0x40000)
                res["has_soft_temp_limit"] = bool(val & 0x80000)

                # Determine health summary
                if res["under_voltage"]:
                    res["healthy"] = False
                    res["message"] = "Under-voltage detected (Low Power Adapter)"
                elif res["throttled"]:
                    res["healthy"] = False
                    res["message"] = "Thermal Throttling Active (High Temp)"
                elif res["arm_freq_capped"]:
                    res["healthy"] = False
                    res["message"] = "ARM Frequency Capped"
                elif res["has_under_voltage"] or res["has_throttled"]:
                    res["healthy"] = True
                    res["message"] = "Normal (Past throttling/voltage drop recorded)"
                else:
                    res["healthy"] = True
                    res["message"] = "Optimal (Normal)"
        except Exception as e:
            res["error"] = str(e)
        return res

    # ── Background Deterministic Sampler ─────────────────────────────────────

    def _sampling_worker(self) -> None:
        """Background thread executing fixed 1.0s sampling cycles."""
        logger.info("Telemetry background sampler loop started.")
        while not self._stop_sampler.is_set():
            t0 = time.time()
            try:
                snapshot = self._compute_snapshot()
                with self.lock:
                    self._latest_telemetry = snapshot
            except Exception as e:
                logger.error(f"Error in telemetry sampler tick: {e}", exc_info=True)

            elapsed = time.time() - t0
            sleep_sec = max(0.1, 1.0 - elapsed)
            time.sleep(sleep_sec)

    def _compute_snapshot(self) -> Dict[str, Any]:
        """
        Compiles the comprehensive, fine-grained telemetry snapshot:
        1. System CPU, RAM, Swap, Disk, Network
        2. Hardware Health & Throttling
        3. Attribution (In-Platform vs Out-of-Platform & Top External Processes)
        4. Internal Processes, Pipelines, Nodes
        """
        now = time.time()
        io_elapsed = max(now - self._last_io_time, 0.5)
        self._last_io_time = now

        # 1. System Level Metrics
        total_cpu = psutil.cpu_percent(interval=None)
        cpu_cores = psutil.cpu_percent(percpu=True, interval=None)
        ram = psutil.virtual_memory()
        swap = psutil.swap_memory()
        temp_c = self._read_cpu_temp()
        freq_mhz = self._read_cpu_freq_mhz()
        core_volt = self._read_core_voltage_v()
        health = self._read_throttled_status()

        # Disk I/O & Capacity
        disk_usage = psutil.disk_usage("/")
        disk_read_mbps = 0.0
        disk_write_mbps = 0.0
        try:
            curr_disk_io = psutil.disk_io_counters()
            if self._last_disk_io and curr_disk_io:
                r_bytes = max(0, curr_disk_io.read_bytes - self._last_disk_io.read_bytes)
                w_bytes = max(0, curr_disk_io.write_bytes - self._last_disk_io.write_bytes)
                disk_read_mbps = round((r_bytes / (1024 * 1024)) / io_elapsed, 2)
                disk_write_mbps = round((w_bytes / (1024 * 1024)) / io_elapsed, 2)
            self._last_disk_io = curr_disk_io
        except Exception:
            pass

        # Network Throughput
        net_rx_kbps = 0.0
        net_tx_kbps = 0.0
        try:
            curr_net_io = psutil.net_io_counters()
            if self._last_net_io and curr_net_io:
                rx_bytes = max(0, curr_net_io.bytes_recv - self._last_net_io.bytes_recv)
                tx_bytes = max(0, curr_net_io.bytes_sent - self._last_net_io.bytes_sent)
                net_rx_kbps = round((rx_bytes * 8 / 1024) / io_elapsed, 1)
                net_tx_kbps = round((tx_bytes * 8 / 1024) / io_elapsed, 1)
            self._last_net_io = curr_net_io
        except Exception:
            pass

        # 2. In-Platform Process Detection & Tree Construction
        internal_pids: Set[int] = {self.main_proc.pid}
        try:
            for child in self.main_proc.children(recursive=True):
                if child.is_running():
                    internal_pids.add(child.pid)
        except Exception:
            pass

        # Discover root launcher (e.g. start.sh / concurrently) and all sibling services
        try:
            for parent in self.main_proc.parents():
                if parent.pid == 1:
                    break
                try:
                    cmd_parent = " ".join(parent.cmdline()).lower()
                    if 'start.sh' in cmd_parent or 'concurrently' in cmd_parent or 'pido-ai' in cmd_parent:
                        internal_pids.add(parent.pid)
                        for child in parent.children(recursive=True):
                            if child.is_running():
                                internal_pids.add(child.pid)
                except Exception:
                    pass
        except Exception:
            pass

        # Include MediaMTX
        if not self.mediamtx_pid:
            self._find_mediamtx_process()
        if self.mediamtx_pid:
            internal_pids.add(self.mediamtx_pid)
            try:
                m_proc = psutil.Process(self.mediamtx_pid)
                for child in m_proc.children(recursive=True):
                    if child.is_running():
                        internal_pids.add(child.pid)
            except Exception:
                pass

        # Include Frontend & child processes
        if not self.frontend_pid:
            self._find_frontend_process()
        if self.frontend_pid:
            internal_pids.add(self.frontend_pid)
            try:
                f_proc_obj = psutil.Process(self.frontend_pid)
                for child in f_proc_obj.children(recursive=True):
                    internal_pids.add(child.pid)
            except Exception:
                pass

        # Include Tracked Subprocesses
        for pid in list(self.tracked_processes.keys()):
            internal_pids.add(pid)

        # Build In-Platform Process List
        processes_list: List[Dict[str, Any]] = []
        internal_cpu_sum: float = 0.0
        internal_ram_mb_sum: float = 0.0

        # Main Backend
        try:
            main_cpu = self.main_proc.cpu_percent(interval=None)
            main_mem = round(self.main_proc.memory_info().rss / (1024 * 1024), 1)
            internal_cpu_sum += main_cpu
            internal_ram_mb_sum += main_mem
            processes_list.append({
                "name": "PiDo Core (FastAPI / AI Worker)",
                "raw_name": "python3",
                "pid": self.main_proc.pid,
                "user": "pi",
                "cpu_percent": round(main_cpu, 1),
                "memory_mb": main_mem,
                "role": "core",
                "ecosystem": "pido",
                "category": "core"
            })
        except Exception:
            pass

        # MediaMTX
        if self.mediamtx_pid:
            try:
                m_proc = psutil.Process(self.mediamtx_pid)
                m_cpu = m_proc.cpu_percent(interval=None)
                m_mem = round(m_proc.memory_info().rss / (1024 * 1024), 1)
                internal_cpu_sum += m_cpu
                internal_ram_mb_sum += m_mem
                processes_list.append({
                    "name": "MediaMTX (RTSP / WebRTC Server)",
                    "raw_name": "mediamtx",
                    "pid": self.mediamtx_pid,
                    "user": "pi",
                    "cpu_percent": round(m_cpu, 1),
                    "memory_mb": m_mem,
                    "role": "media_server",
                    "ecosystem": "pido",
                    "category": "media_server"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                self.mediamtx_pid = None

        # Frontend (Vite)
        if self.frontend_pid:
            try:
                f_proc = psutil.Process(self.frontend_pid)
                f_cpu = f_proc.cpu_percent(interval=None)
                f_mem = round(f_proc.memory_info().rss / (1024 * 1024), 1)
                internal_cpu_sum += f_cpu
                internal_ram_mb_sum += f_mem
                processes_list.append({
                    "name": "PiDo Frontend (Vite Dev Server)",
                    "raw_name": "node",
                    "pid": self.frontend_pid,
                    "user": "pi",
                    "cpu_percent": round(f_cpu, 1),
                    "memory_mb": f_mem,
                    "role": "frontend",
                    "ecosystem": "pido",
                    "category": "frontend"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                self.frontend_pid = None

        # Tracked subprocesses
        dead_pids: List[int] = []
        for pid, info in list(self.tracked_processes.items()):
            try:
                proc = info["proc"]
                p_cpu = proc.cpu_percent(interval=None)
                p_mem = round(proc.memory_info().rss / (1024 * 1024), 1)
                internal_cpu_sum += p_cpu
                internal_ram_mb_sum += p_mem
                processes_list.append({
                    "name": info["name"],
                    "raw_name": "worker",
                    "pid": pid,
                    "user": "pi",
                    "pipeline_id": info.get("pipeline_id"),
                    "cpu_percent": round(p_cpu, 1),
                    "memory_mb": p_mem,
                    "role": "subprocess",
                    "ecosystem": "pido",
                    "category": "subprocess"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                dead_pids.append(pid)

        for pid in dead_pids:
            self.tracked_processes.pop(pid, None)

        # 3. Out-of-Platform (External) Process Scanning
        external_procs_pool: List[Dict[str, Any]] = []
        try:
            for p in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_info']):
                try:
                    pid = p.info['pid']
                    if pid == 0 or pid in internal_pids:
                        continue
                    mem_rss = (p.info.get('memory_info').rss if p.info.get('memory_info') else 0) / (1024 * 1024)
                    cpu_p = p.info.get('cpu_percent') or 0.0
                    raw_name = p.info.get('name') or f"proc_{pid}"

                    friendly_name = raw_name
                    category = "system"  # 'ide' | 'external' | 'system'
                    try:
                        name_lower = raw_name.lower()
                        # Direct binary / process name checks
                        if 'language_server' in name_lower or 'languageserver' in name_lower:
                            friendly_name = "IDE Language Server (LSP)"
                            category = "ide"
                        elif 'node-red' in name_lower:
                            friendly_name = "Node-RED Server"
                            category = "external"
                        elif 'lxtask' in name_lower:
                            friendly_name = "LXTask (Task Manager)"
                            category = "system"
                        elif 'chromium' in name_lower:
                            friendly_name = "Chromium Browser"
                            category = "external"
                        elif name_lower in ('node', 'python', 'python3', 'sh', 'bash'):
                            cmd = " ".join(p.cmdline())
                            cmd_l = cmd.lower()
                            if 'pido-ai' in cmd_l:
                                internal_pids.add(pid)
                                continue
                            elif '.antigravity-ide-server' in cmd_l or '.gemini' in cmd_l or 'vscode' in cmd_l:
                                category = "ide"
                                if 'server-main.js' in cmd_l:
                                    friendly_name = "Antigravity IDE Server"
                                elif 'extensionhost' in cmd_l:
                                    friendly_name = "Antigravity Extension Host"
                                elif 'clickup-mcp-server' in cmd_l:
                                    friendly_name = "ClickUp MCP Server"
                                elif 'typingsinstaller' in cmd_l:
                                    friendly_name = "TypeScript Typings Installer"
                                elif 'language_server' in cmd_l or 'languageserver' in cmd_l:
                                    friendly_name = "IDE Language Server (LSP)"
                                elif 'bootstrap-fork' in cmd_l:
                                    friendly_name = "IDE Background Worker"
                                else:
                                    friendly_name = "Antigravity IDE Service"
                            elif 'node-red' in cmd_l:
                                friendly_name = "Node-RED Server"
                                category = "external"
                            elif 'chromium' in cmd_l:
                                friendly_name = "Chromium Browser"
                                category = "external"
                            else:
                                args = cmd.split()
                                if len(args) > 1:
                                    script_name = args[1].split('/')[-1]
                                    friendly_name = f"{raw_name} ({script_name[:24]})"
                    except Exception:
                        pass

                    external_procs_pool.append({
                        "pid": pid,
                        "name": friendly_name,
                        "raw_name": raw_name,
                        "category": category,
                        "ecosystem": "external",
                        "user": p.info.get('username') or "-",
                        "cpu_percent": round(cpu_p, 1),
                        "memory_mb": round(mem_rss, 1)
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception as e:
            logger.debug(f"External process scan exception: {e}")

        # Top external processes prioritizing both CPU and RAM
        by_cpu = sorted(external_procs_pool, key=lambda x: (x["cpu_percent"], x["memory_mb"]), reverse=True)[:15]
        by_ram = sorted(external_procs_pool, key=lambda x: (x["memory_mb"], x["cpu_percent"]), reverse=True)[:15]
        seen_pids = set()
        top_external: List[Dict[str, Any]] = []
        for p in by_cpu + by_ram:
            if p["pid"] not in seen_pids:
                seen_pids.add(p["pid"])
                top_external.append(p)
        top_external.sort(key=lambda x: (x["cpu_percent"], x["memory_mb"]), reverse=True)
        top_external = top_external[:20]

        # Attribution Calculations
        ram_total_mb = round(ram.total / (1024 * 1024), 1)
        ram_used_mb = round((ram.total - ram.available) / (1024 * 1024), 1)
        external_cpu = max(0.0, round(total_cpu - internal_cpu_sum, 1))
        external_ram_mb = max(0.0, round(ram_used_mb - internal_ram_mb_sum, 1))
        idle_cpu = max(0.0, round(100.0 - total_cpu, 1))

        # 4. Pipelines & Nodes
        pipelines_list: List[Dict[str, Any]] = []
        global_npu_util: float = 0.0

        for pid, pdata in list(self.pipelines.items()):
            if pdata.get("status") != "running":
                continue

            nodes_list: List[Dict[str, Any]] = []
            pipe_cpu: float = 0.0
            pipe_npu: float = 0.0

            for nid, node_obj in list(pdata.get("nodes", {}).items()):
                n_stat = node_obj.roll_up(time_window_sec=io_elapsed, num_cores=self.num_cores)
                nodes_list.append(n_stat)
                pipe_cpu += n_stat.get("cpu_percent", 0.0)
                if n_stat.get("npu_percent", 0.0) > 0:
                    pipe_npu = max(pipe_npu, n_stat["npu_percent"])

            # Add subprocess CPU associated with this pipeline
            for proc_info in processes_list:
                if proc_info.get("pipeline_id") == pid:
                    pipe_cpu += proc_info.get("cpu_percent", 0.0)

            pipe_cpu = round(min(100.0, pipe_cpu), 1)
            global_npu_util = max(global_npu_util, pipe_npu)

            pipelines_list.append({
                "pipeline_id": pid,
                "name": pdata.get("name", pid),
                "status": pdata["status"],
                "cpu_percent": pipe_cpu,
                "npu_percent": round(pipe_npu, 1),
                "nodes": nodes_list
            })

        # 5. Assemble Payload
        telemetry: Dict[str, Any] = {
            "timestamp": round(now, 2),
            "system": {
                "cpu_percent": round(total_cpu, 1),
                "cpu_cores": [round(c, 1) for c in cpu_cores],
                "ram_percent": round(ram.percent, 1),
                "ram_used_mb": ram_used_mb,
                "ram_total_mb": ram_total_mb,
                "swap_percent": round(swap.percent, 1),
                "swap_used_mb": round(swap.used / (1024 * 1024), 1),
                "swap_total_mb": round(swap.total / (1024 * 1024), 1),
                "disk_percent": round(disk_usage.percent, 1),
                "disk_used_gb": round(disk_usage.used / (1024 * 1024 * 1024), 1),
                "disk_total_gb": round(disk_usage.total / (1024 * 1024 * 1024), 1),
                "disk_free_gb": round(disk_usage.free / (1024 * 1024 * 1024), 1),
                "disk_read_mbps": disk_read_mbps,
                "disk_write_mbps": disk_write_mbps,
                "net_rx_kbps": net_rx_kbps,
                "net_tx_kbps": net_tx_kbps,
                "temp_c": temp_c,
                "cpu_freq_mhz": freq_mhz,
                "core_voltage_v": core_volt,
                "npu_percent": round(global_npu_util, 1),
                "npu_device": getattr(self, "_npu_device_label", "Hailo NPU (PCIe)"),
                "hardware_health": health
            },
            "attribution": {
                "internal_cpu_percent": round(internal_cpu_sum, 1),
                "internal_ram_mb": round(internal_ram_mb_sum, 1),
                "internal_ram_percent": round((internal_ram_mb_sum / max(ram_total_mb, 1.0)) * 100.0, 1),
                "external_cpu_percent": external_cpu,
                "external_ram_mb": external_ram_mb,
                "external_ram_percent": round((external_ram_mb / max(ram_total_mb, 1.0)) * 100.0, 1),
                "idle_cpu_percent": idle_cpu,
                "top_external_processes": top_external
            },
            "processes": processes_list,
            "pipelines": pipelines_list,
            # Backward-compatibility fields for legacy widgets:
            "cpu_percent": round(total_cpu, 1),
            "ram_percent": round(ram.percent, 1),
            "temp_c": temp_c,
            "npu_percent": round(global_npu_util, 1)
        }

        return telemetry

    def get_full_telemetry(self) -> Dict[str, Any]:
        """
        Returns real-time fine-grained telemetry snapshot from the 1Hz precision cache.
        Guarantees zero jitter and sub-millisecond response.
        """
        with self.lock:
            if self._latest_telemetry:
                return dict(self._latest_telemetry)
        # Fallback if sampler thread hasn't finished initial tick
        return self._compute_snapshot()

    def stop(self) -> None:
        """Stops the background sampler loop cleanly."""
        self._stop_sampler.set()
        if self._sampler_thread.is_alive():
            self._sampler_thread.join(timeout=2.0)


# Global singleton instance
telemetry_mgr: TelemetryManager = TelemetryManager()
