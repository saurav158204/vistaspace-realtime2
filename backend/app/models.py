"""Telemetry payload format shared by every sensor transport (serial, MQTT, HTTP, simulator).

Every field except ``device_id`` is optional, so a device only sends what it measures. Example:

    {
      "device_id": "rack-a2-esp32",
      "ts": "2026-09-29T11:00:00Z",
      "ambient_temp_c": 22.4,
      "device_temp_c": 41.2,
      "humidity_pct": 38.5,
      "pressure_hpa": 1012.3,
      "imu": {"ax": 0.01, "ay": -0.02, "az": 9.80, "gx": 0.1, "gy": 0.0, "gz": -0.1},
      "battery": {"voltage_v": 3.92, "percent": 81, "charging": false},
      "power_w": 1.35,
      "custom": {"sample_chamber_c": 4.1}
    }
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Source = Literal["hardware", "api", "simulated"]
Transport = Literal["serial", "mqtt", "http", "sim"]


class IMU(BaseModel):
    model_config = ConfigDict(extra="allow")
    ax: Optional[float] = Field(None, description="acceleration x, m/s²")
    ay: Optional[float] = None
    az: Optional[float] = None
    gx: Optional[float] = Field(None, description="angular rate x, deg/s")
    gy: Optional[float] = None
    gz: Optional[float] = None


class Battery(BaseModel):
    voltage_v: Optional[float] = None
    percent: Optional[float] = Field(None, ge=0, le=100)
    charging: Optional[bool] = None


class TelemetryIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(..., min_length=1, max_length=64)
    ts: Optional[datetime] = Field(None, description="device timestamp (ISO 8601); server time is used if absent")
    ambient_temp_c: Optional[float] = None
    device_temp_c: Optional[float] = None
    humidity_pct: Optional[float] = Field(None, ge=0, le=100)
    pressure_hpa: Optional[float] = None
    imu: Optional[IMU] = None
    battery: Optional[Battery] = None
    power_w: Optional[float] = None
    custom: dict[str, float | int | str | bool] = Field(default_factory=dict)


class TelemetryRecord(BaseModel):
    """A reading as stored and streamed: the payload plus where it came from and when the server got it."""
    source: Source
    transport: Transport
    received_at: datetime
    reading: TelemetryIn

    @classmethod
    def make(cls, reading: TelemetryIn, source: Source, transport: Transport) -> "TelemetryRecord":
        return cls(source=source, transport=transport, received_at=datetime.now(timezone.utc), reading=reading)


class MissionEvent(BaseModel):
    """A mission-log event posted by the console (gesture, posture alert, step progression, override …)."""
    model_config = ConfigDict(extra="allow")
    id: str
    ts: datetime
    kind: str
    level: str = "info"
    title: str
    message: str = ""
    data: dict = Field(default_factory=dict)
