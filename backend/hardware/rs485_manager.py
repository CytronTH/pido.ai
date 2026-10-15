import os
import glob
import logging
import serial
import threading
from typing import Optional, List

logger = logging.getLogger(__name__)


def list_serial_ports() -> List[str]:
    """Finds potential RS485 / Serial ports on Raspberry Pi."""
    ports = glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*")
    return sorted(ports)


class RS485Manager:
    def __init__(self, port: str = "/dev/ttyUSB0", baudrate: int = 9600) -> None:
        self.port: str = port
        self.baudrate: int = baudrate
        self.ser: Optional[serial.Serial] = None
        self.lock = threading.Lock()
        self._init_serial()

    def _init_serial(self) -> None:
        # Check if requested port exists; if not, check fallback ports
        target_port = self.port
        if not os.path.exists(target_port):
            available = list_serial_ports()
            if available:
                target_port = available[0]
                logger.info(
                    f"RS485 port {self.port} not found, falling back to detected port: {target_port}"
                )
            else:
                logger.warning(
                    f"RS485 port {self.port} not found and no /dev/ttyUSB* or /dev/ttyACM* available"
                )

        if not os.path.exists(target_port):
            return

        with self.lock:
            if self.ser and self.ser.is_open:
                try:
                    self.ser.close()
                except Exception as e:
                    logger.debug(f"Error closing serial: {e}")
                self.ser = None

            try:
                self.ser = serial.Serial(
                    port=target_port,
                    baudrate=self.baudrate,
                    timeout=1.0,
                    write_timeout=1.0,
                    parity=serial.PARITY_NONE,
                    stopbits=serial.STOPBITS_ONE,
                    bytesize=serial.EIGHTBITS,
                )
                self.port = target_port
                logger.info(f"Initialized RS485 on {self.port} at {self.baudrate} baud")
            except Exception as e:
                logger.error(f"Failed to open RS485 port {target_port}: {e}")

    def configure(self, port: Optional[str] = None, baudrate: Optional[int] = None) -> None:
        """Dynamically reconfigures port and baudrate if changed."""
        changed = False
        if port and port != self.port:
            self.port = port
            changed = True
        if baudrate and baudrate != self.baudrate:
            self.baudrate = baudrate
            changed = True

        if changed or self.ser is None or not self.ser.is_open:
            self._init_serial()

    def send_data(self, data: bytes) -> bool:
        if self.ser is None or not self.ser.is_open:
            self._init_serial()

        if self.ser and self.ser.is_open:
            with self.lock:
                try:
                    self.ser.write(data)
                    self.ser.flush()
                    return True
                except Exception as e:
                    logger.error(f"RS485 send error on {self.port}: {e}")
        return False

    def read_data(self, size: int = 1024) -> bytes:
        if self.ser and self.ser.is_open:
            with self.lock:
                try:
                    if self.ser.in_waiting > 0:
                        return self.ser.read(min(size, self.ser.in_waiting))
                except Exception as e:
                    logger.error(f"RS485 read error on {self.port}: {e}")
        return b""

    def close(self) -> None:
        with self.lock:
            if self.ser and self.ser.is_open:
                try:
                    self.ser.close()
                except Exception as e:
                    logger.error(f"Error closing RS485 port {self.port}: {e}")
                self.ser = None


# Global Singleton
rs485_mgr = RS485Manager()
