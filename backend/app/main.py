"""VISTASpace backend: sensor telemetry (serial / MQTT / HTTP / simulated fallback), object detection, mission log.

Run:  uvicorn app.main:app --reload            (from backend/, with the venv active)
Docs: http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
import platform
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
import psutil
from fastapi import FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .config import settings
from .db import Database
from .detection.base import NullDetector
from .detection.tracker import IouTracker
from .models import MissionEvent, TelemetryIn
from .sensors.manager import SensorHub
from .sensors.simulator import run_simulator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vista")

STARTED = time.time()


class State:
    db: Database
    hub: SensorHub
    detector = NullDetector("loading")
    adapters: list = []
    tasks: list[asyncio.Task] = []


S = State()


def host_metrics() -> dict:
    """Real metrics of the machine running this backend (not the headset/browser)."""
    m = {"hostname": platform.node(), "cpu_percent": psutil.cpu_percent(interval=None), "cpu_count": psutil.cpu_count(),
         "memory_percent": psutil.virtual_memory().percent, "uptime_s": round(time.time() - STARTED)}
    temps = getattr(psutil, "sensors_temperatures", None)
    if temps:
        try:
            t = temps()
            flat = [x.current for arr in t.values() for x in arr if x.current]
            m["cpu_temp_c"] = round(max(flat), 1) if flat else None
        except Exception:
            m["cpu_temp_c"] = None
    else:
        m["cpu_temp_c"] = None
    return m


async def load_detector() -> None:
    from .detection.yolo import build_detector

    S.detector = await asyncio.to_thread(build_detector, settings.detector, settings.yolo_model, settings.yolo_conf)
    log.info("detector: %s", S.detector.info.as_dict())


@asynccontextmanager
async def lifespan(app: FastAPI):
    S.db = Database(settings.db_path)
    S.hub = SensorHub(S.db, settings.stale_seconds, settings.sim_fallback)
    S.hub.bind_loop(asyncio.get_running_loop())
    psutil.cpu_percent(interval=None)  # prime the CPU counter
    S.hub.set_adapter("http", enabled=True, state="listening", endpoint="/api/telemetry", auth=bool(settings.ingest_token))
    if settings.serial_port:
        from .sensors.serial_adapter import SerialAdapter
        a = SerialAdapter(S.hub, settings.serial_port, settings.serial_baud); a.start(); S.adapters.append(a)
    else:
        S.hub.set_adapter("serial", enabled=False, state="not configured")
    if settings.mqtt_host:
        from .sensors.mqtt_adapter import MqttAdapter
        a = MqttAdapter(S.hub, settings.mqtt_host, settings.mqtt_port, settings.mqtt_topic, settings.mqtt_username, settings.mqtt_password)
        a.start(); S.adapters.append(a)
    else:
        S.hub.set_adapter("mqtt", enabled=False, state="not configured")
    if settings.sim_fallback:
        S.tasks.append(asyncio.create_task(run_simulator(S.hub, settings.sim_interval)))
    else:
        S.hub.set_adapter("simulator", enabled=False, state="disabled")
    S.tasks.append(asyncio.create_task(load_detector()))
    yield
    for t in S.tasks:
        t.cancel()
    for a in S.adapters:
        a.stop()
    S.db.close()


app = FastAPI(title="VISTASpace backend", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])


def full_status() -> dict:
    return {"type": "status", "server_time": time.time(), "sensors": S.hub.status(), "detector": S.detector.info.as_dict(), "host": host_metrics()}


@app.get("/api/health")
def health():
    return {"ok": True, "version": app.version, "uptime_s": round(time.time() - STARTED)}


@app.get("/api/status")
def status():
    return full_status()


@app.post("/api/telemetry", status_code=202)
def post_telemetry(reading: TelemetryIn, authorization: str | None = Header(default=None)):
    """HTTP ingest for devices (ESP32 / Raspberry Pi / any script). Counted as LIVE API."""
    if settings.ingest_token and authorization != f"Bearer {settings.ingest_token}":
        raise HTTPException(401, "missing or wrong bearer token")
    rec = S.hub.ingest(reading, "api", "http")
    return {"accepted": True, "received_at": rec.received_at.isoformat()}


@app.get("/api/telemetry/history")
def telemetry_history(limit: int = Query(200, le=5000), include_simulated: bool = True):
    return S.db.telemetry_history(limit, include_simulated)


@app.post("/api/events", status_code=201)
def post_event(ev: MissionEvent):
    S.db.add_event(ev)
    return {"stored": ev.id}


@app.get("/api/events")
def get_events(format: str = "json", limit: int = Query(1000, le=20000)):
    rows = S.db.events(limit)
    if format != "csv":
        return rows
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "ts", "kind", "level", "title", "message", "data"])
    for r in rows:
        w.writerow([r["id"], r["ts"], r["kind"], r["level"], r["title"], r["message"], r["data"]])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=mission-log.csv"})


@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket):
    """Pushes {"type":"status"} every second, {"type":"telemetry"} for every reading, and a history snapshot on connect."""
    await ws.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)
    unsub = S.hub.subscribe(lambda m: queue.put_nowait(m) if not queue.full() else None)
    try:
        await ws.send_json({"type": "hello", "history": S.db.telemetry_history(120)})
        await ws.send_json(full_status())
        last = time.monotonic()
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=max(0.05, 1.0 - (time.monotonic() - last)))
                await ws.send_json(msg)
            except asyncio.TimeoutError:
                pass
            if time.monotonic() - last >= 1.0:
                last = time.monotonic()
                await ws.send_json(full_status())
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        unsub()


@app.websocket("/ws/detect")
async def ws_detect(ws: WebSocket):
    """Client sends JPEG frames as binary messages (one at a time, waiting for the reply); server answers with detections."""
    await ws.accept()
    tracker = IouTracker()
    frame_id = 0
    await ws.send_json({"type": "detector", **S.detector.info.as_dict()})
    try:
        while True:
            data = await ws.receive_bytes()
            frame_id += 1
            if not S.detector.info.available:
                await ws.send_json({"type": "detections", "frame_id": frame_id, "available": False, "reason": S.detector.info.reason, "detections": []})
                continue
            img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                await ws.send_json({"type": "error", "frame_id": frame_id, "error": "could not decode JPEG"})
                continue
            t0 = time.perf_counter()
            dets = await asyncio.to_thread(S.detector.detect, img)
            ms = (time.perf_counter() - t0) * 1000
            dets = tracker.update(dets)
            await ws.send_json({"type": "detections", "available": True, "frame_id": frame_id, "model": S.detector.info.name,
                                "inference_ms": round(ms, 1), "width": img.shape[1], "height": img.shape[0],
                                "detections": [d.as_dict() for d in dets]})
    except (WebSocketDisconnect, RuntimeError):
        pass
