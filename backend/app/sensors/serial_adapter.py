"""USB serial adapter (Arduino, ESP32, Raspberry Pi Pico, …): one JSON object per line at VISTA_SERIAL_BAUD."""
from __future__ import annotations

import logging
import threading
import time

from .manager import SensorHub
from .parsing import parse_payload

log = logging.getLogger("vista.serial")


class SerialAdapter:
    name = "serial"

    def __init__(self, hub: SensorHub, port: str, baud: int):
        self.hub, self.port, self.baud = hub, port, baud
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="serial-adapter", daemon=True)

    def start(self) -> None:
        self.hub.set_adapter(self.name, enabled=True, port=self.port, baud=self.baud, state="connecting", error=None)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        import serial  # pyserial

        backoff = 1.0
        while not self._stop.is_set():
            try:
                with serial.Serial(self.port, self.baud, timeout=1) as ser:
                    self.hub.set_adapter(self.name, state="connected", error=None)
                    log.info("serial connected on %s @ %d", self.port, self.baud)
                    backoff = 1.0
                    while not self._stop.is_set():
                        line = ser.readline()
                        if not line:
                            continue
                        try:
                            reading = parse_payload(line, default_device="serial:" + self.port)
                        except ValueError as e:
                            self.hub.set_adapter(self.name, last_error=str(e))
                            continue
                        if reading:
                            self.hub.ingest(reading, "hardware", "serial")
            except Exception as e:  # port missing, unplugged, permission denied …
                self.hub.set_adapter(self.name, state="disconnected", error=str(e))
                log.warning("serial %s: %s (retrying in %.0fs)", self.port, e, backoff)
                self._stop.wait(backoff)
                backoff = min(backoff * 2, 15)
        self.hub.set_adapter(self.name, state="stopped")
