"""Minimal IoU tracker: gives each detection a stable id across frames while it stays in view."""
from __future__ import annotations

from .base import Detection


def iou(a, b) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix, iy = max(0.0, min(ax + aw, bx + bw) - max(ax, bx)), max(0.0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


class IouTracker:
    def __init__(self, threshold: float = 0.3, max_missed: int = 5):
        self.threshold, self.max_missed = threshold, max_missed
        self.tracks: dict[int, dict] = {}
        self.next_id = 1

    def update(self, dets: list[Detection]) -> list[Detection]:
        used: set[int] = set()
        for d in sorted(dets, key=lambda d: -d.conf):
            best, best_iou = None, self.threshold
            for tid, t in self.tracks.items():
                if tid in used or t["label"] != d.label:
                    continue
                v = iou(t["box"], d.box)
                if v > best_iou:
                    best, best_iou = tid, v
            if best is None:
                best = self.next_id
                self.next_id += 1
            self.tracks[best] = {"label": d.label, "box": d.box, "missed": 0}
            d.id = best
            used.add(best)
        for tid in list(self.tracks):
            if tid not in used:
                self.tracks[tid]["missed"] += 1
                if self.tracks[tid]["missed"] > self.max_missed:
                    del self.tracks[tid]
        return dets
