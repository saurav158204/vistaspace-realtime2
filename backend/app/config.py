"""Runtime settings, read from environment variables (and backend/.env if present)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None or v == "" else v.strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str) -> list[str]:
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]


@dataclass
class Settings:
    host: str = field(default_factory=lambda: os.getenv("VISTA_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: int(os.getenv("VISTA_PORT", "8000")))
    cors_origins: list[str] = field(default_factory=lambda: _list(
        "VISTA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"))
    db_path: Path = field(default_factory=lambda: BACKEND_DIR / os.getenv("VISTA_DB_PATH", "data/vistaspace.db"))
    stale_seconds: float = field(default_factory=lambda: float(os.getenv("VISTA_STALE_SECONDS", "5")))

    serial_port: str = field(default_factory=lambda: os.getenv("VISTA_SERIAL_PORT", ""))
    serial_baud: int = field(default_factory=lambda: int(os.getenv("VISTA_SERIAL_BAUD", "115200")))

    mqtt_host: str = field(default_factory=lambda: os.getenv("VISTA_MQTT_HOST", ""))
    mqtt_port: int = field(default_factory=lambda: int(os.getenv("VISTA_MQTT_PORT", "1883")))
    mqtt_topic: str = field(default_factory=lambda: os.getenv("VISTA_MQTT_TOPIC", "vistaspace/telemetry/#"))
    mqtt_username: str = field(default_factory=lambda: os.getenv("VISTA_MQTT_USERNAME", ""))
    mqtt_password: str = field(default_factory=lambda: os.getenv("VISTA_MQTT_PASSWORD", ""))

    ingest_token: str = field(default_factory=lambda: os.getenv("VISTA_INGEST_TOKEN", ""))

    sim_fallback: bool = field(default_factory=lambda: _bool("VISTA_SIM_FALLBACK", False))
    sim_interval: float = field(default_factory=lambda: float(os.getenv("VISTA_SIM_INTERVAL", "1.0")))

    detector: str = field(default_factory=lambda: os.getenv("VISTA_DETECTOR", "yolo").lower())
    yolo_model: str = field(default_factory=lambda: os.getenv("VISTA_YOLO_MODEL", "yolov8n.pt"))
    yolo_conf: float = field(default_factory=lambda: float(os.getenv("VISTA_YOLO_CONF", "0.35")))


settings = Settings()
