# VISTASpace backend (FastAPI)

This service handles sensor telemetry from serial, MQTT, HTTP or a labelled simulator. It also runs pluggable object
detection (YOLOv8), keeps an SQLite mission log and telemetry history, and reports host metrics. See `../app/README.md`
for the whole system.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt            # + requirements-yolo.txt for YOLOv8, + requirements-dev.txt for tests
cp .env.example .env
uvicorn app.main:app --port 8000           # add --host 0.0.0.0 to accept devices on your LAN
pytest -q
```

## Endpoints

| | |
|---|---|
| `GET /api/health`, `GET /api/status` | Liveness; sensors (active source, adapters, counts), detector, host metrics |
| `POST /api/telemetry` | Device ingest (JSON payload, see `app/models.py`). Labelled `LIVE API`. Optional `Authorization: Bearer $VISTA_INGEST_TOKEN` |
| `GET /api/telemetry/history?limit=&include_simulated=` | Stored readings with `source` and `transport` |
| `POST /api/events`, `GET /api/events?format=json\|csv` | Mission log (the console mirrors every event here) |
| `WS /ws/telemetry` | `hello` (history), `status` every 1 s, `telemetry` per reading: `{source, label, transport, received_at, reading}` |
| `WS /ws/detect` | Client sends JPEG frames (binary). Replies `{type:"detections", available, model, inference_ms, detections:[{id,label,conf,box:[x,y,w,h]}]}` with normalized boxes; `available:false` + `reason` when no model |

## Source labels

- `LIVE HARDWARE`: serial or MQTT reading within `VISTA_STALE_SECONDS`.
- `LIVE API`: otherwise, an HTTP POST within that window.
- `SIMULATED FALLBACK`: otherwise, only if `VISTA_SIM_FALLBACK=true`. The simulator pauses whenever a live source reports.
- `DISCONNECTED`: nothing is reporting.

## Detection

`VISTA_DETECTOR=yolo` loads `VISTA_YOLO_MODEL` (default `yolov8n.pt`) with ultralytics. A path ending in `.onnx` runs
through OpenCV DNN instead, with no PyTorch needed (export with `yolo export model=yolov8n.pt format=onnx opset=12`).
If neither can load, the detector reports why and returns no detections. Add a new model by implementing
`detect(frame_bgr) -> list[Detection]` (see `app/detection/base.py`).

## Hardware

Firmware and scripts are in `firmware/`: an Arduino serial sketch, an ESP32 HTTP sketch, and a Raspberry Pi BME280
script. `tools/device_simulator.py` impersonates a device over HTTP, a virtual serial port or MQTT, for testing.
