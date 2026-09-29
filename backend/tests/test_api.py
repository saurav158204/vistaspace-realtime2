"""API and source-labelling tests. Run from backend/:  pytest -q"""
import os
import tempfile
import time

os.environ["VISTA_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["VISTA_DETECTOR"] = "none"
os.environ["VISTA_SERIAL_PORT"] = ""
os.environ["VISTA_MQTT_HOST"] = ""
os.environ["VISTA_SIM_FALLBACK"] = "false"
os.environ["VISTA_STALE_SECONDS"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PAYLOAD = {"device_id": "t1", "ambient_temp_c": 22.5, "humidity_pct": 40, "imu": {"ax": 0.1}, "battery": {"percent": 80}, "custom": {"x": 1}}


def test_disconnected_then_live_api_then_stale():
    with TestClient(app) as c:
        s = c.get("/api/status").json()
        assert s["sensors"]["active_label"] == "DISCONNECTED"
        assert s["detector"]["available"] is False

        r = c.post("/api/telemetry", json=PAYLOAD)
        assert r.status_code == 202
        s = c.get("/api/status").json()
        assert s["sensors"]["active_label"] == "LIVE API"

        time.sleep(1.2)
        assert c.get("/api/status").json()["sensors"]["active_label"] == "DISCONNECTED"

        hist = c.get("/api/telemetry/history").json()
        assert hist[-1]["source"] == "api" and hist[-1]["reading"]["ambient_temp_c"] == 22.5


def test_rejects_bad_payload():
    with TestClient(app) as c:
        assert c.post("/api/telemetry", json={"ambient_temp_c": 1}).status_code == 422  # device_id missing
        assert c.post("/api/telemetry", json={"device_id": "x", "humidity_pct": 140}).status_code == 422


def test_ws_streams_readings_with_source_label():
    with TestClient(app) as c, c.websocket_connect("/ws/telemetry") as ws:
        assert ws.receive_json()["type"] == "hello"
        assert ws.receive_json()["type"] == "status"
        c.post("/api/telemetry", json=PAYLOAD)
        for _ in range(5):
            m = ws.receive_json()
            if m["type"] == "telemetry":
                assert m["source"] == "api" and m["label"] == "LIVE API" and m["transport"] == "http"
                break
        else:
            raise AssertionError("no telemetry message")


def test_events_json_and_csv():
    with TestClient(app) as c:
        ev = {"id": "e1", "ts": "2026-09-29T10:00:00Z", "kind": "gesture", "level": "info", "title": "THUMBS UP", "message": "right hand", "data": {"conf": 0.9}}
        assert c.post("/api/events", json=ev).status_code == 201
        assert c.get("/api/events").json()[-1]["data"]["conf"] == 0.9
        csv = c.get("/api/events?format=csv").text
        assert "THUMBS UP" in csv.splitlines()[-1]


def test_detect_ws_reports_unavailable_honestly():
    with TestClient(app) as c, c.websocket_connect("/ws/detect") as ws:
        info = ws.receive_json()
        assert info["type"] == "detector" and info["available"] is False
        ws.send_bytes(b"\xff\xd8\xff")
        m = ws.receive_json()
        assert m["available"] is False and m["detections"] == []
