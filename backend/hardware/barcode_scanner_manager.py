import os
import glob
import time
import socket
import select
import struct
import logging
import threading
from typing import Optional, List, Dict, Any, Callable

logger = logging.getLogger(__name__)

# Standard Linux Scancode mapping (struct input_event)
# Format: scancode: (normal_char, shifted_char)
SCANCODE_MAP: Dict[int, tuple] = {
    2: ('1', '!'), 3: ('2', '@'), 4: ('3', '#'), 5: ('4', '$'), 6: ('5', '%'),
    7: ('6', '^'), 8: ('7', '&'), 9: ('8', '*'), 10: ('9', '('), 11: ('0', ')'),
    12: ('-', '_'), 13: ('=', '+'), 14: ('\b', '\b'), 15: ('\t', '\t'),
    16: ('q', 'Q'), 17: ('w', 'W'), 18: ('e', 'E'), 19: ('r', 'R'), 20: ('t', 'T'),
    21: ('y', 'Y'), 22: ('u', 'U'), 23: ('i', 'I'), 24: ('o', 'O'), 25: ('p', 'P'),
    26: ('[', '{'), 27: (']', '}'), 28: ('\n', '\n'),
    30: ('a', 'A'), 31: ('s', 'S'), 32: ('d', 'D'), 33: ('f', 'F'), 34: ('g', 'G'),
    35: ('h', 'H'), 36: ('j', 'J'), 37: ('k', 'K'), 38: ('l', 'L'), 39: (';', ':'),
    40: ("'", '"'), 41: ('`', '~'),
    43: ('\\', '|'), 44: ('z', 'Z'), 45: ('x', 'X'), 46: ('c', 'C'), 47: ('v', 'V'),
    48: ('b', 'B'), 49: ('n', 'N'), 50: ('m', 'M'), 51: (',', '<'), 52: ('.', '>'),
    53: ('/', '?'), 57: (' ', ' '),
    # Numpad / Keypad
    71: ('7', '7'), 72: ('8', '8'), 73: ('9', '9'), 74: ('-', '-'),
    75: ('4', '4'), 76: ('5', '5'), 77: ('6', '6'), 78: ('+', '+'),
    79: ('1', '1'), 80: ('2', '2'), 81: ('3', '3'), 82: ('0', '0'),
    83: ('.', '.'), 96: ('\n', '\n'),
}

SHIFT_CODES = {42, 54}  # KEY_LEFTSHIFT, KEY_RIGHTSHIFT


def list_serial_ports() -> List[Dict[str, str]]:
    """List available serial/USB CDC-ACM ports on Linux/RPi."""
    try:
        ports = sorted(glob.glob("/dev/ttyACM*") + glob.glob("/dev/ttyUSB*"))
        result = []
        for p in ports:
            result.append({
                "port": p,
                "label": f"{p} ({'USB CDC-ACM' if 'ACM' in p else 'USB Serial'})"
            })
        return result
    except Exception as e:
        logger.error(f"Error listing serial ports: {e}")
        return []


def list_input_devices() -> List[Dict[str, str]]:
    """List available event input devices (/dev/input/event*) on Linux/RPi."""
    devices = []
    try:
        event_paths = sorted(glob.glob("/dev/input/event*"))
        for ep in event_paths:
            name = ep
            name_file = f"/sys/class/input/{os.path.basename(ep)}/device/name"
            if os.path.exists(name_file):
                try:
                    with open(name_file, "r") as f:
                        name = f.read().strip()
                except Exception:
                    pass
            devices.append({
                "path": ep,
                "name": name,
                "label": f"{ep} — {name}"
            })
    except Exception as e:
        logger.error(f"Error listing input devices: {e}")
    return devices


class BaseScannerReader:
    def __init__(self, on_scan: Callable[[str], None]) -> None:
        self.on_scan = on_scan
        self.running = False
        self._stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None

    def start(self) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        self.running = False
        self._stop_event.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.5)
            self.thread = None


class SerialScannerReader(BaseScannerReader):
    """Reads barcode from USB Serial (CDC-ACM) port."""

    def __init__(
        self,
        port: str,
        baudrate: int,
        delimiter: str,
        on_scan: Callable[[str], None]
    ) -> None:
        super().__init__(on_scan)
        self.port = port
        self.baudrate = baudrate
        self.delimiter = delimiter or "\r\n"
        self._ser = None

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def _read_loop(self) -> None:
        import serial
        logger.info(f"Starting SerialScannerReader on {self.port} at {self.baudrate} baud")
        buffer = bytearray()
        delim_bytes = self.delimiter.encode("utf-8")

        while self.running and not self._stop_event.is_set():
            try:
                if not os.path.exists(self.port):
                    self._stop_event.wait(1.0)
                    continue

                if self._ser is None or not self._ser.is_open:
                    self._ser = serial.Serial(
                        port=self.port,
                        baudrate=self.baudrate,
                        timeout=0.5
                    )
                    logger.info(f"Serial scanner connected on {self.port}")

                # Read available bytes with timeout
                data = self._ser.read(self._ser.in_waiting or 1)
                if data:
                    buffer.extend(data)
                    # Check delimiter
                    if delim_bytes in buffer:
                        parts = buffer.split(delim_bytes)
                        # Process complete lines
                        for line in parts[:-1]:
                            text = line.decode("utf-8", errors="ignore").strip()
                            if text:
                                self.on_scan(text)
                        buffer = bytearray(parts[-1])
            except Exception as e:
                logger.debug(f"Serial scanner read exception on {self.port}: {e}")
                if self._ser:
                    try:
                        self._ser.close()
                    except Exception:
                        pass
                    self._ser = None
                self._stop_event.wait(1.0)

        # Cleanup on exit
        if self._ser:
            try:
                self._ser.close()
            except Exception:
                pass
            self._ser = None

    def stop(self) -> None:
        self.running = False
        self._stop_event.set()
        if self._ser:
            try:
                self._ser.close()
            except Exception:
                pass
            self._ser = None
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.5)
            self.thread = None


class HIDScannerReader(BaseScannerReader):
    """Reads barcode directly from Linux /dev/input/event* without requiring window focus."""

    def __init__(
        self,
        device_path: str,
        on_scan: Callable[[str], None]
    ) -> None:
        super().__init__(on_scan)
        self.device_path = device_path

    def _resolve_device_path(self) -> Optional[str]:
        if self.device_path and self.device_path != "auto" and os.path.exists(self.device_path):
            return self.device_path
        # Auto-detect scanner/keyboard device
        devs = list_input_devices()
        for d in devs:
            lower_name = d["name"].lower()
            if any(k in lower_name for k in ["barcode", "scanner", "reader", "zebra", "honeywell", "symbol", "datalogic"]):
                return d["path"]
        # If no explicit barcode scanner, fallback to first non-power-button device
        for d in devs:
            if "pwr_button" not in d["name"] and "hdmi" not in d["name"]:
                return d["path"]
        return devs[0]["path"] if devs else None

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def _read_loop(self) -> None:
        logger.info(f"Starting HIDScannerReader on {self.device_path}")
        event_struct_format = "qqHHi"
        event_size = struct.calcsize(event_struct_format)

        accumulated_chars: List[str] = []
        is_shift = False

        while self.running and not self._stop_event.is_set():
            fd = None
            try:
                dev_path = self._resolve_device_path()
                if not dev_path or not os.path.exists(dev_path):
                    self._stop_event.wait(1.0)
                    continue

                fd = os.open(dev_path, os.O_RDONLY | os.O_NONBLOCK)
                logger.info(f"HID scanner listening on {dev_path}")

                while self.running and not self._stop_event.is_set():
                    # Non-blocking poll with 0.5s timeout
                    r, _, _ = select.select([fd], [], [], 0.5)
                    if not r:
                        continue

                    raw_data = os.read(fd, event_size)
                    if len(raw_data) < event_size:
                        continue

                    _, _, ev_type, code, value = struct.unpack(event_struct_format, raw_data)

                    # EV_KEY = 1
                    if ev_type != 1:
                        continue

                    # Key Press = 1, Key Repeat = 2, Key Release = 0
                    if code in SHIFT_CODES:
                        is_shift = (value != 0)
                        continue

                    # Only process on Key Press (value == 1)
                    if value == 1:
                        if code in (28, 96):  # KEY_ENTER or KEY_KPENTER
                            full_code = "".join(accumulated_chars).strip()
                            accumulated_chars.clear()
                            if full_code:
                                self.on_scan(full_code)
                        elif code == 14:  # KEY_BACKSPACE
                            if accumulated_chars:
                                accumulated_chars.pop()
                        elif code in SCANCODE_MAP:
                            norm_char, shift_char = SCANCODE_MAP[code]
                            char_to_add = shift_char if is_shift else norm_char
                            accumulated_chars.append(char_to_add)

            except Exception as e:
                logger.debug(f"HID scanner read error: {e}")
                self._stop_event.wait(1.0)
            finally:
                if fd is not None:
                    try:
                        os.close(fd)
                    except Exception:
                        pass

    def stop(self) -> None:
        self.running = False
        self._stop_event.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.5)
            self.thread = None


class TCPScannerReader(BaseScannerReader):
    """Reads barcode from TCP/IP socket connection."""

    def __init__(
        self,
        host: str,
        port: int,
        delimiter: str,
        on_scan: Callable[[str], None]
    ) -> None:
        super().__init__(on_scan)
        self.host = host
        self.port = port
        self.delimiter = delimiter or "\r\n"
        self._sock: Optional[socket.socket] = None

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def _read_loop(self) -> None:
        logger.info(f"Starting TCPScannerReader connecting to {self.host}:{self.port}")
        delim_bytes = self.delimiter.encode("utf-8")
        buffer = bytearray()

        while self.running and not self._stop_event.is_set():
            try:
                self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self._sock.settimeout(2.0)
                self._sock.connect((self.host, self.port))
                self._sock.settimeout(0.5)
                logger.info(f"Connected to TCP barcode scanner at {self.host}:{self.port}")

                while self.running and not self._stop_event.is_set():
                    try:
                        data = self._sock.recv(1024)
                        if not data:
                            break  # Connection closed
                        buffer.extend(data)
                        if delim_bytes in buffer:
                            parts = buffer.split(delim_bytes)
                            for p in parts[:-1]:
                                text = p.decode("utf-8", errors="ignore").strip()
                                if text:
                                    self.on_scan(text)
                            buffer = bytearray(parts[-1])
                    except socket.timeout:
                        continue
            except Exception as e:
                logger.debug(f"TCP scanner socket error on {self.host}:{self.port}: {e}")
                self._stop_event.wait(2.0)
            finally:
                if self._sock:
                    try:
                        self._sock.close()
                    except Exception:
                        pass
                    self._sock = None

    def stop(self) -> None:
        self.running = False
        self._stop_event.set()
        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass
            self._sock = None
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.5)
            self.thread = None
