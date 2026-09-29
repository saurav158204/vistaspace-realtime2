"""Turn a raw line/message from a device into a validated TelemetryIn."""
from __future__ import annotations

import json

from pydantic import ValidationError

from ..models import TelemetryIn


def parse_payload(raw: bytes | str, default_device: str) -> TelemetryIn | None:
    """Accepts one JSON object (the documented payload). Returns None for blank/noise lines, raises ValueError if invalid."""
    text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw
    text = text.strip()
    if not text or not text.startswith("{"):
        return None  # boot banners, debug prints, partial lines
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON: {e.msg}") from e
    if not isinstance(obj, dict):
        raise ValueError("payload must be a JSON object")
    obj.setdefault("device_id", default_device)
    try:
        return TelemetryIn.model_validate(obj)
    except ValidationError as e:
        raise ValueError(e.errors(include_url=False)[0]["msg"]) from e
