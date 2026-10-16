import logging
import threading
from typing import Union, Optional, Dict, Any
from gpiozero import DigitalInputDevice, DigitalOutputDevice, PWMOutputDevice, Buzzer

logger = logging.getLogger(__name__)


def parse_pin(pin: Union[int, str, None]) -> Optional[int]:
    """
    Parses a pin specification into an integer BCM GPIO number for Raspberry Pi 5.
    Supports:
      - Integers: 17 -> 17
      - Digits as strings: "17" -> 17
      - "GPIOxx" / "gpioxx": "GPIO17" / "gpio17" -> 17
    Returns None if unparseable or out of standard GPIO range (0-27).
    """
    if pin is None:
        return None
    if isinstance(pin, int):
        return pin if 0 <= pin <= 27 else None
    pin_str = str(pin).strip()
    if pin_str.isdigit():
        val = int(pin_str)
        return val if 0 <= val <= 27 else None
    upper = pin_str.upper()
    if upper.startswith("GPIO") and upper[4:].isdigit():
        val = int(upper[4:])
        return val if 0 <= val <= 27 else None
    return None


class GPIOManager:
    def __init__(self) -> None:
        self.devices: Dict[str, Any] = {}
        self._timers: Dict[str, threading.Timer] = {}
        self._lock = threading.Lock()
        logger.info("Initializing GPIO Manager for Raspberry Pi 5 (RP1 40-Pin Header)...")

    def setup_input(
        self,
        name: str,
        pin: Union[int, str],
        bounce_time: float = 0.1,
        pull_resistor: Optional[str] = "up",
    ) -> None:
        """
        Setup a Digital Input pin.
        pull_resistor:
          - 'up': Internal pull-up resistor (typical for switches to GND)
          - 'down': Internal pull-down resistor
          - 'none' or None: Floating (requires external resistor)
        """
        pin_num = parse_pin(pin)
        if pin_num is None:
            logger.error(f"Invalid pin for input {name}: {pin}")
            return

        with self._lock:
            # Close previous device if existing with same name
            if name in self.devices:
                try:
                    self.devices[name].close()
                except Exception as e:
                    logger.debug(f"Error closing old device {name}: {e}")
                del self.devices[name]

            pull_up: Optional[bool]
            if pull_resistor == "up":
                pull_up = True
            elif pull_resistor == "down":
                pull_up = False
            else:
                pull_up = None

            try:
                self.devices[name] = DigitalInputDevice(
                    pin_num, pull_up=pull_up, bounce_time=bounce_time
                )
                logger.info(
                    f"Initialized Input {name} on BCM GPIO{pin_num} (pull_resistor={pull_resistor})"
                )
            except Exception as e:
                logger.error(f"Failed to init input {name} on GPIO{pin_num}: {e}")

    def setup_output(
        self,
        name: str,
        pin: Union[int, str],
        active_high: bool = True,
        initial_value: bool = False,
    ) -> None:
        """
        Setup a Digital Output pin.
        active_high:
          - True: Logic HIGH (3.3V) when ON (standard)
          - False: Logic LOW (0V) when ON (useful for active-low relay modules)
        """
        pin_num = parse_pin(pin)
        if pin_num is None:
            logger.error(f"Invalid pin for output {name}: {pin}")
            return

        with self._lock:
            if name in self.devices:
                try:
                    self.devices[name].close()
                except Exception as e:
                    logger.debug(f"Error closing old device {name}: {e}")
                del self.devices[name]

            try:
                self.devices[name] = DigitalOutputDevice(
                    pin_num, active_high=active_high, initial_value=initial_value
                )
                logger.info(
                    f"Initialized Output {name} on BCM GPIO{pin_num} (active_high={active_high})"
                )
            except Exception as e:
                logger.error(f"Failed to init output {name} on GPIO{pin_num}: {e}")

    def setup_pwm(
        self,
        name: str,
        pin: Union[int, str],
        frequency: int = 100,
        initial_value: float = 0.0,
    ) -> None:
        """
        Setup PWM output for LED dimming or analog-like control.
        """
        pin_num = parse_pin(pin)
        if pin_num is None:
            logger.error(f"Invalid pin for PWM {name}: {pin}")
            return

        with self._lock:
            if name in self.devices:
                try:
                    self.devices[name].close()
                except Exception as e:
                    logger.debug(f"Error closing old device {name}: {e}")
                del self.devices[name]

            try:
                self.devices[name] = PWMOutputDevice(
                    pin_num, frequency=frequency, initial_value=initial_value
                )
                logger.info(f"Initialized PWM {name} on BCM GPIO{pin_num} ({frequency}Hz)")
            except Exception as e:
                logger.error(f"Failed to init PWM {name} on GPIO{pin_num}: {e}")

    def setup_buzzer(
        self,
        name: str,
        pin: Union[int, str],
        active_high: bool = True,
    ) -> None:
        """
        Setup an Active Buzzer on given BCM pin.
        """
        pin_num = parse_pin(pin)
        if pin_num is None:
            logger.error(f"Invalid pin for buzzer {name}: {pin}")
            return

        with self._lock:
            if name in self.devices:
                try:
                    self.devices[name].close()
                except Exception as e:
                    logger.debug(f"Error closing old device {name}: {e}")
                del self.devices[name]

            try:
                self.devices[name] = Buzzer(pin_num, active_high=active_high)
                logger.info(f"Initialized Buzzer {name} on BCM GPIO{pin_num}")
            except Exception as e:
                logger.error(f"Failed to init buzzer {name} on GPIO{pin_num}: {e}")

    def set_output(self, name: str, state: bool) -> None:
        """Sets the output device state (ON/OFF)."""
        device = self.devices.get(name)
        if device and hasattr(device, "on") and hasattr(device, "off"):
            try:
                if state:
                    device.on()
                else:
                    device.off()
            except Exception as e:
                logger.error(f"Error setting output {name} to {state}: {e}")

    def trigger_buzzer(self, name: str, duration: float = 1.0) -> None:
        """
        Turns on the buzzer and automatically turns it off after `duration` seconds.
        Cancels any previous pending timer for this buzzer.
        """
        with self._lock:
            if name in self._timers:
                try:
                    self._timers[name].cancel()
                except Exception:
                    pass
                del self._timers[name]

            self.set_output(name, True)

            if duration > 0:
                def _auto_off():
                    self.set_output(name, False)
                    with self._lock:
                        self._timers.pop(name, None)

                timer = threading.Timer(duration, _auto_off)
                timer.daemon = True
                self._timers[name] = timer
                timer.start()

    def set_pwm(self, name: str, value: float) -> None:
        """Value from 0.0 to 1.0."""
        device = self.devices.get(name)
        if device and isinstance(device, PWMOutputDevice):
            try:
                device.value = max(0.0, min(1.0, value))
            except Exception as e:
                logger.error(f"Error setting PWM {name} to {value}: {e}")

    def get_input(self, name: str) -> bool:
        """Returns True if the input device is active, else False."""
        device = self.devices.get(name)
        if device and isinstance(device, DigitalInputDevice):
            try:
                return device.is_active
            except Exception as e:
                logger.error(f"Error reading input {name}: {e}")
        return False

    def turn_off_all(self) -> None:
        """Gracefully resets and turns off all devices."""
        with self._lock:
            for name, timer in list(self._timers.items()):
                try:
                    timer.cancel()
                except Exception:
                    pass
            self._timers.clear()

            for name, device in self.devices.items():
                try:
                    if hasattr(device, "value"):
                        device.value = 0.0
                    elif hasattr(device, "off"):
                        device.off()
                except Exception as e:
                    logger.error(f"Error turning off {name}: {e}")

    def close(self) -> None:
        """Closes all hardware devices cleanly."""
        self.turn_off_all()
        with self._lock:
            for name, device in self.devices.items():
                try:
                    device.close()
                except Exception as e:
                    logger.error(f"Error closing {name}: {e}")
            self.devices.clear()


# Global Singleton
gpio_mgr = GPIOManager()
