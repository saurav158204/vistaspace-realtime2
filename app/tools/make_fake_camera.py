#!/usr/bin/env python3
"""Build a Chrome fake-webcam video (.y4m) from MediaPipe's public test photos, to test the vision pipeline without a
real camera. Segments: upright pose → pose rotated 25° (posture alert) → thumbs up → fist → pointing → two right hands.

  python tools/make_fake_camera.py /tmp/fakecam.y4m          (needs: pip install opencv-python-headless numpy)
  chrome --use-fake-device-for-media-stream --use-file-for-fake-video-capture=/tmp/fakecam.y4m http://localhost:5173

The images are MediaPipe's own test assets; the video is real imagery, but it is a recording, not a live camera.
"""
import sys
import urllib.request

import cv2
import numpy as np

BASE = "https://storage.googleapis.com/mediapipe-assets/"
W, H, FPS = 640, 480, 15


def load(name):
    data = urllib.request.urlopen(BASE + name, timeout=30).read()
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def fit(im):
    c = np.full((H, W, 3), 235, np.uint8)
    s = min(W / im.shape[1], H / im.shape[0])
    im = cv2.resize(im, (int(im.shape[1] * s), int(im.shape[0] * s)))
    y, x = (H - im.shape[0]) // 2, (W - im.shape[1]) // 2
    c[y:y + im.shape[0], x:x + im.shape[1]] = im
    return c


def rot(im, a):
    return cv2.warpAffine(im, cv2.getRotationMatrix2D((W / 2, H / 2), a, 1.0), (W, H), borderValue=(235, 235, 235))


def main(out):
    pose = fit(load("pose.jpg"))
    segs = [(pose, 4), (rot(pose, -25), 4), (fit(load("thumb_up.jpg")), 3), (fit(load("fist.jpg")), 3),
            (fit(load("pointing_up.jpg")), 3), (fit(load("right_hands.jpg")), 2), (fit(load("victory.jpg")), 2)]
    with open(out, "wb") as f:
        f.write(f"YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n".encode())
        for im, sec in segs:
            for _ in range(sec * FPS):
                j = np.clip(im.astype(np.int16) + np.random.randint(-2, 3, im.shape), 0, 255).astype(np.uint8)
                f.write(b"FRAME\n" + cv2.cvtColor(j, cv2.COLOR_BGR2YUV_I420).tobytes())
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "fakecam.y4m")
