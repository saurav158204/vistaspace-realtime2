"""Pluggable object-detection service.

A detector takes a BGR frame (numpy array) and returns detections with normalized boxes. The WebSocket layer adds
tracking IDs (see tracker.py) and streams results as:

    {"type": "detections", "frame_id": 12, "model": "yolov8n", "inference_ms": 38.2, "width": 640, "height": 360,
     "detections": [{"id": 3, "label": "bottle", "conf": 0.81, "box": [x, y, w, h]}]}   # box normalized 0..1
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np


@dataclass
class Detection:
    label: str
    conf: float
    box: tuple[float, float, float, float]  # x, y, w, h normalized to the frame
    id: int | None = None

    def as_dict(self) -> dict:
        return {"id": self.id, "label": self.label, "conf": round(self.conf, 3), "box": [round(v, 4) for v in self.box]}


@dataclass
class DetectorInfo:
    available: bool
    name: str
    reason: str = ""
    labels: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"available": self.available, "name": self.name, "reason": self.reason, "label_count": len(self.labels)}


class Detector(Protocol):
    info: DetectorInfo

    def detect(self, frame_bgr: np.ndarray) -> list[Detection]: ...


class NullDetector:
    """Used when no model is installed/configured. Reports why, never fabricates detections."""

    def __init__(self, reason: str):
        self.info = DetectorInfo(False, "none", reason)

    def detect(self, frame_bgr: np.ndarray) -> list[Detection]:
        return []
