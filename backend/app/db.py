"""SQLite storage for telemetry history and the mission log."""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

from .models import MissionEvent, TelemetryRecord

SCHEMA = """
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  device_ts TEXT,
  device_id TEXT NOT NULL,
  source TEXT NOT NULL,          -- hardware | api | simulated
  transport TEXT NOT NULL,       -- serial | mqtt | http | sim
  ambient_temp_c REAL, device_temp_c REAL, humidity_pct REAL, pressure_hpa REAL, power_w REAL,
  payload TEXT NOT NULL          -- full JSON reading
);
CREATE INDEX IF NOT EXISTS telemetry_time ON telemetry(received_at);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_time ON events(ts);
"""


class Database:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)

    def add_telemetry(self, rec: TelemetryRecord) -> None:
        r = rec.reading
        with self._lock:
            self._conn.execute(
                "INSERT INTO telemetry (received_at, device_ts, device_id, source, transport, ambient_temp_c, device_temp_c,"
                " humidity_pct, pressure_hpa, power_w, payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (rec.received_at.isoformat(), r.ts.isoformat() if r.ts else None, r.device_id, rec.source, rec.transport,
                 r.ambient_temp_c, r.device_temp_c, r.humidity_pct, r.pressure_hpa, r.power_w, r.model_dump_json()))
            self._conn.commit()

    def telemetry_history(self, limit: int = 200, include_simulated: bool = True) -> list[dict]:
        q = "SELECT * FROM telemetry" + ("" if include_simulated else " WHERE source != 'simulated'") + " ORDER BY id DESC LIMIT ?"
        with self._lock:
            rows = self._conn.execute(q, (limit,)).fetchall()
        return [{"received_at": x["received_at"], "source": x["source"], "transport": x["transport"],
                 "reading": json.loads(x["payload"])} for x in reversed(rows)]

    def add_event(self, ev: MissionEvent) -> None:
        with self._lock:
            self._conn.execute("INSERT OR REPLACE INTO events (id, ts, kind, level, title, message, data) VALUES (?,?,?,?,?,?,?)",
                               (ev.id, ev.ts.isoformat(), ev.kind, ev.level, ev.title, ev.message, json.dumps(ev.data)))
            self._conn.commit()

    def events(self, limit: int = 1000) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM events ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
        return [{**dict(x), "data": json.loads(x["data"] or "{}")} for x in reversed(rows)]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
