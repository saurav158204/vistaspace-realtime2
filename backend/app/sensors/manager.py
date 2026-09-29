"""Sensor hub: receives readings from every adapter, stores them, fans them out to WebSocket clients, and decides
which source is active.

Active-source rules (shown verbatim in the console):
  LIVE HARDWARE       a serial or MQTT device reported within VISTA_STALE_SECONDS
  LIVE API            otherwise, a device POSTed to /api/telemetry within VISTA_STALE_SECONDS
  SIMULATED FALLBACK  otherwise, and the simulator is enabled (VISTA_SIM_FALLBACK=true)
  DISCONNECTED        nothing is reporting
Simulated readings are only generated while no live source is reporting and always carry source="simulated".
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable

from ..db import Database
from ..models import TelemetryIn, TelemetryRecord

log = logging.getLogger("vista.sensors")

LABELS = {"hardware": "LIVE HARDWARE", "api": "LIVE API", "simulated": "SIMULATED FALLBACK", None: "DISCONNECTED"}


class SensorHub:
    def __init__(self, db: Database, stale_seconds: float, sim_enabled: bool):
        self.db = db
        self.stale = stale_seconds
        self.sim_enabled = sim_enabled
        self.last_seen: dict[str, float] = {}         # source -> monotonic time of last reading
        self.last_record: dict[str, TelemetryRecord] = {}
        self.adapters: dict[str, dict[str, Any]] = {}  # adapter name -> status info
        self.counts: dict[str, int] = {"hardware": 0, "api": 0, "simulated": 0}
        self._listeners: list[Callable[[dict], Any]] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, fn: Callable[[dict], Any]) -> Callable[[], None]:
        self._listeners.append(fn)
        return lambda: self._listeners.remove(fn) if fn in self._listeners else None

    def set_adapter(self, name: str, **info: Any) -> None:
        self.adapters[name] = {**self.adapters.get(name, {}), **info}

    def live_source(self) -> str | None:
        now = time.monotonic()
        for src in ("hardware", "api"):
            if now - self.last_seen.get(src, -1e9) <= self.stale:
                return src
        return None

    def active_source(self) -> str | None:
        live = self.live_source()
        if live:
            return live
        if self.sim_enabled and time.monotonic() - self.last_seen.get("simulated", -1e9) <= self.stale:
            return "simulated"
        return None

    def status(self) -> dict:
        src = self.active_source()
        now = time.monotonic()
        return {
            "active_source": src,
            "active_label": LABELS[src],
            "sim_enabled": self.sim_enabled,
            "stale_seconds": self.stale,
            "age_seconds": {k: round(now - v, 2) for k, v in self.last_seen.items()},
            "counts": self.counts,
            "adapters": self.adapters,
        }

    def ingest(self, reading: TelemetryIn, source: str, transport: str) -> TelemetryRecord:
        """Thread-safe: adapters running in threads call this too."""
        rec = TelemetryRecord.make(reading, source, transport)  # type: ignore[arg-type]
        self.db.add_telemetry(rec)
        self.last_seen[source] = time.monotonic()
        self.last_record[source] = rec
        self.counts[source] = self.counts.get(source, 0) + 1
        msg = {"type": "telemetry", "source": source, "label": LABELS[source], "transport": transport,
               "received_at": rec.received_at.isoformat(), "reading": reading.model_dump(mode="json", exclude_none=True)}
        self._emit(msg)
        return rec

    def _emit(self, msg: dict) -> None:
        for fn in list(self._listeners):
            if self._loop and self._loop.is_running():
                try:
                    running = asyncio.get_running_loop()
                except RuntimeError:
                    running = None
                if running is self._loop:
                    fn(msg)
                else:
                    self._loop.call_soon_threadsafe(fn, msg)
            else:
                fn(msg)
