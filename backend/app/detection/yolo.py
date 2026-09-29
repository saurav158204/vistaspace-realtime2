"""YOLOv8 via ultralytics (pip install -r requirements-yolo.txt). The model file is downloaded on first use."""
from __future__ import annotations

import numpy as np

from .base import Detection, DetectorInfo


class YoloDetector:
    def __init__(self, model_path: str, conf: float):
        from ultralytics import YOLO  # ImportError is handled by build_detector

        self.model = YOLO(model_path)
        self.conf = conf
        names = self.model.names
        self.info = DetectorInfo(True, "yolov8:" + model_path, labels=[names[k] for k in sorted(names)])

    def detect(self, frame_bgr: np.ndarray) -> list[Detection]:
        h, w = frame_bgr.shape[:2]
        res = self.model.predict(frame_bgr, conf=self.conf, verbose=False, imgsz=640)[0]
        out = []
        for b in res.boxes:
            x1, y1, x2, y2 = (float(v) for v in b.xyxy[0].tolist())
            out.append(Detection(self.model.names[int(b.cls[0])], float(b.conf[0]), (x1 / w, y1 / h, (x2 - x1) / w, (y2 - y1) / h)))
        return out


class OnnxDetector:
    """YOLOv8 exported to ONNX, run with OpenCV DNN (no PyTorch needed). Set VISTA_YOLO_MODEL=path/to/yolov8n.onnx.
    Export once with:  yolo export model=yolov8n.pt format=onnx opset=12"""

    COCO = ("person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign parking_meter bench bird "
            "cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella handbag tie suitcase frisbee skis snowboard sports_ball "
            "kite baseball_bat baseball_glove skateboard surfboard tennis_racket bottle wine_glass cup fork knife spoon bowl banana apple "
            "sandwich orange broccoli carrot hot_dog pizza donut cake chair couch potted_plant bed dining_table toilet tv laptop mouse "
            "remote keyboard cell_phone microwave oven toaster sink refrigerator book clock vase scissors teddy_bear hair_drier toothbrush").split()

    def __init__(self, model_path: str, conf: float):
        import cv2

        self.cv2 = cv2
        self.net = cv2.dnn.readNetFromONNX(model_path)
        self.conf = conf
        self.labels = [x.replace("_", " ") for x in self.COCO]
        self.info = DetectorInfo(True, "yolov8-onnx:" + model_path, labels=self.labels)

    def detect(self, frame_bgr: np.ndarray) -> list[Detection]:
        cv2 = self.cv2
        h, w = frame_bgr.shape[:2]
        s = max(h, w)
        square = np.zeros((s, s, 3), np.uint8)
        square[:h, :w] = frame_bgr
        blob = cv2.dnn.blobFromImage(square, 1 / 255.0, (640, 640), swapRB=True)
        self.net.setInput(blob)
        pred = self.net.forward()[0].T  # (8400, 84): cx, cy, w, h, 80 class scores
        scores = pred[:, 4:]
        cls = scores.argmax(1)
        conf = scores[np.arange(len(cls)), cls]
        keep = conf >= self.conf
        pred, cls, conf = pred[keep], cls[keep], conf[keep]
        k = s / 640.0
        boxes = [[(cx - bw / 2) * k, (cy - bh / 2) * k, bw * k, bh * k] for cx, cy, bw, bh in pred[:, :4]]
        idx = cv2.dnn.NMSBoxes(boxes, conf.tolist(), self.conf, 0.45)
        out = []
        for i in np.array(idx).flatten():
            x, y, bw, bh = boxes[i]
            out.append(Detection(self.labels[int(cls[i])], float(conf[i]), (max(0, x / w), max(0, y / h), bw / w, bh / h)))
        return out


def build_detector(kind: str, model_path: str, conf: float):
    from .base import NullDetector

    if kind in ("none", "off", ""):
        return NullDetector("disabled (VISTA_DETECTOR=none)")
    if model_path.endswith(".onnx"):
        try:
            return OnnxDetector(model_path, conf)
        except Exception as e:
            return NullDetector(f"ONNX model could not be loaded: {e}")
    try:
        return YoloDetector(model_path, conf)
    except ImportError:
        return NullDetector("ultralytics is not installed (pip install -r requirements-yolo.txt)")
    except Exception as e:
        return NullDetector(f"YOLO model could not be loaded: {e}")
