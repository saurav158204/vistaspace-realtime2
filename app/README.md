# VISTASpace Experiment Intelligence Console

A local, real-time prototype of the VISTASpace mission-control console. It uses the live camera for vision, the
microphone for voice commands, and connected sensor hardware for telemetry. Every value on screen is labelled with
where it comes from. Simulated data only appears as an explicit fallback, and is always labelled `SIMULATED`.

> **Prototype aid only.** Posture and anomaly detection here are not a medical, ergonomic, safety-certified or
> flight-certified system.

```
 browser (this app, Vite + React)                          backend/ (Python FastAPI)
 ┌──────────────────────────────────────────┐              ┌────────────────────────────────────┐
 │ getUserMedia camera ─► MediaPipe tasks    │  WebSocket   │ /ws/telemetry ◄─ serial adapter ◄── Arduino / ESP32 (USB)
 │   GestureRecognizer (hands, gestures)     │◄────────────►│               ◄─ MQTT adapter   ◄── ESP32 / Pi (Wi-Fi)
 │   PoseLandmarker   (posture)              │              │               ◄─ POST /api/telemetry ◄─ any HTTP device
 │   ObjectDetector   (EfficientDet, opt.)   │              │               ◄─ simulator (only if enabled + nothing live)
 │ OpenCV.js worker (motion, contours)       │  JPEG frames │ /ws/detect    ─► YOLOv8 (ultralytics) + IoU tracker
 │ Web Speech API (commands + voice)         │─────────────►│ /api/events   ─► SQLite mission log + telemetry history
 │ procedure engine · mission log · export   │              │ psutil host CPU / memory / temperature
 └──────────────────────────────────────────┘              └────────────────────────────────────┘
```

## Run it

Requirements: Node 20+, Python 3.10+, and Chrome or Edge (for speech recognition). Open the console on
`http://localhost`, because camera and microphone access need a secure origin.

```bash
# 1. Frontend (the first run downloads the MediaPipe models, ~21 MB, into public/models)
cd app
npm install
npm run dev                 # → http://localhost:5173

# 2. Backend (optional but needed for sensors, YOLOv8, SQLite log and host metrics)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # edit to enable serial / MQTT / simulator
uvicorn app.main:app --port 8000                       # API docs → http://127.0.0.1:8000/docs

# 3. Optional: real object detection with YOLOv8 on the backend
pip install -r requirements-yolo.txt                   # PyTorch + ultralytics; yolov8n.pt downloads on first start

# Production build of the frontend (static files in app/dist, serve over http(s) from any web server)
cd app && npm run build && npm run preview
```

After the first run, the frontend loads nothing from the internet: fonts, icons, MediaPipe WASM, models and
OpenCV.js are all served from `public/`. The one exception is speech recognition, which in Chrome and Edge uses the
browser vendor's online speech service.

## What works, and how it is labelled

| Area | Real input | Where it shows | Fallback / honest state |
|---|---|---|---|
| Camera | `getUserMedia`, user-started, fully released on Stop | Main monitor with overlays | `denied`, `no camera`, `in use`, `disconnected`, `unsupported`, `insecure page`, each with its own message |
| Hands + gestures | MediaPipe GestureRecognizer: 21 landmarks, left/right, gesture | Monitor overlay, Hands panel, mission log | Tracking toggles off; nothing shown when off |
| Posture | MediaPipe PoseLandmarker (33 landmarks) → angles | Posture strip, alert banner, mission log, voice | `NOT ASSESSED` when the body is not clearly visible |
| Motion | OpenCV.js worker: frame difference, threshold, dilate, contours | Motion panel, dashed boxes on video | `NO INPUT` / `OFF` |
| Objects | `BROWSER`: EfficientDet-Lite0 (COCO) · `BACKEND`: YOLOv8 + tracking IDs | Boxes on video, Objects strip | `UNAVAILABLE` with the reason (backend down, ultralytics missing). Never fabricated |
| Voice | Web Speech API recognition and synthesis | Voice console (`V`), mic state | `UNAVAILABLE`, `DENIED`, or "did not start" when no speech service; typed commands always work |
| Sensors | Backend WebSocket | Sensor Telemetry panel, footer | `LIVE HARDWARE` · `LIVE API` · `SIMULATED FALLBACK` · `DISCONNECTED` |
| System | Camera FPS, inference ms, `navigator.onLine`/`connection`, `performance.memory`, Battery API, permissions | System Health panel | `UNAVAILABLE` if the browser lacks the API; host CPU/temperature say `NEEDS BACKEND` |

The idle monitor shows the design's hologram scene, labelled **"SCENE MODEL · ILLUSTRATIVE, NOT LIVE DATA"**.

## Gestures

Hold a gesture steadily. A ring around the palm fills while it is held. Each gesture fires once, then must be
released before it can fire again, and each has a 2 s cooldown. Thresholds are in `src/live/gestures.js`.

| Gesture | Detection | Action |
|---|---|---|
| Open palm | recognizer `Open_Palm` ≥ 0.6, held 0.6 s | Shows and speaks the monitoring status |
| Closed fist | `Closed_Fist`, held 0.7 s | Pauses or resumes monitoring (hands stay tracked so a fist can resume) |
| Thumbs up | `Thumb_Up`, held 0.6 s | Confirms the current procedure step (method `gesture`, confidence = gesture score) |
| Pointing | `Pointing_Up`, or index extended with other fingers curled (any direction) | Selects the detected object hit by the index-finger ray; says so honestly when detection is off |
| Pinch | thumb-tip to index-tip distance < 0.22 × palm size | Configurable in Settings: capture evidence, complete step, toggle hand tracking, or speak status |

Each gesture event is logged with the gesture, confidence, hand side, palm position (0–1, as displayed) and timestamp.

## Posture monitoring

Metrics come from pose landmarks in the camera plane (`src/live/posture.js`):

| Metric | Definition | Attention | Critical |
|---|---|---|---|
| Head tilt | Ear line (or eye line) vs horizontal | ≥ 15° | ≥ 30° |
| Neck alignment | Shoulder midpoint → ear midpoint vs vertical | ≥ 20° | ≥ 35° |
| Shoulder level | Shoulder line vs horizontal | ≥ 10° | ≥ 20° |
| Torso lean | Hip midpoint → shoulder midpoint vs vertical (hips must be visible) | ≥ 15° | ≥ 30° |
| Arm elevation | Upper arm vs torso (0° down, 180° overhead) | ≥ 150° | — |
| Visibility | Mean landmark visibility of head, shoulders (and hips) | below 0.55 → not assessed | |

- **Persistence.** A level must hold for 2 s (attention) or 1.5 s (critical) before it changes, and it recovers after 1 s nominal.
- **Unsafe posture.** An unsafe level raises a banner on the video, an ACK-able alert card and a timestamped mission-log event. A spoken warning follows unless voice alerts are muted.
- **Calibrate.** Press Calibrate (or say "calibrate posture") while sitting neutrally. The head, neck, shoulder and torso angles are then measured relative to that position. Place the camera level and facing the person.

## Voice commands

Press **V** or click the voice area, then speak; or type in the command box. **Hands-free** keeps listening. Commands
call the real functions. Phrases also work in Hindi (e.g. "निगरानी शुरू करो", "मेरी मुद्रा कैसी है", "चरण पूर्ण").

| Say | Runs |
|---|---|
| Start monitoring / Stop monitoring / Pause monitoring | Camera + vision start, full release, or pause |
| Enable hand tracking / Disable hand tracking (also pose tracking) | Turns the MediaPipe task on or off |
| What is my posture status? | Reads the current level and angles |
| Read current procedure · Next step · Previous step · Repeat instruction | Procedure engine; next and previous are logged as overrides |
| Mark step complete | Completes the step with method `voice` and the recognition confidence |
| Mute alerts / Unmute alerts | Spoken alerts only; visual alerts always stay on |
| Show temperature | Highlights telemetry and reads it with its source label |
| Show system health | Highlights and reads the System Health panel |
| Calibrate posture · Capture evidence · Monitoring status · Help · Hindi / English | As named |

Keyboard: **V** talk · **A** acknowledge alert · **Esc** close.

## Procedure engine

Steps live in `src/live/procedure.json`. Each step has `id`, `title`, `instruction`, Hindi text, and an optional `auto`
rule. Any step can be completed manually (Complete button), by voice or by thumbs up. A step completes on its own only
while its rule actually holds on live detections:

| Rule | Example |
|---|---|
| `pose_visible` | `{ "type": "pose_visible", "minVisibility": 0.6, "seconds": 2 }` |
| `posture_nominal` | `{ "type": "posture_nominal", "seconds": 3 }` |
| `hands_visible` | `{ "type": "hands_visible", "count": 2, "seconds": 1.5 }` |
| `object_present` | `{ "type": "object_present", "label": "bottle", "minConf": 0.5, "seconds": 1.5 }` (needs BROWSER or BACKEND detection; otherwise the guidance bar says it is blocked) |

Every completion stores an evidence record: method, time, step duration, confidence, a camera snapshot with overlays,
and the detection context. Click a verified row or the Evidence card to view it. The mission log (every progression,
warning, override, gesture, posture change, voice command and sensor-source change) exports as **JSON** (with
snapshots) or **CSV** from the footer. When the backend is connected, events are also stored in SQLite
(`GET /api/events?format=csv`).

## Sensor hardware setup

The backend accepts one JSON object per reading. Only `device_id` is required:

```json
{ "device_id": "rack-a2-esp32", "ts": "2026-09-29T11:00:00Z",
  "ambient_temp_c": 22.4, "device_temp_c": 41.2, "humidity_pct": 38.5, "pressure_hpa": 1012.3,
  "imu": { "ax": 0.01, "ay": -0.02, "az": 9.80, "gx": 0.1, "gy": 0.0, "gz": -0.1 },
  "battery": { "voltage_v": 3.92, "percent": 81, "charging": false }, "power_w": 1.35,
  "custom": { "sample_chamber_c": 4.1 } }
```

| Device | How | Shows as |
|---|---|---|
| Arduino / ESP32 / Pico over USB | Flash `backend/firmware/arduino_serial_sensor` (DHT22 on D2). Set `VISTA_SERIAL_PORT=/dev/ttyUSB0` (Windows `COM3`), baud 115200 | `LIVE HARDWARE` |
| ESP32 over Wi-Fi | Flash `backend/firmware/esp32_http_sensor` (BME280). Set Wi-Fi + `BACKEND_URL`; run the backend with `--host 0.0.0.0` | `LIVE API` |
| Raspberry Pi | `python backend/firmware/raspberry_pi_bme280.py --url http://<backend>:8000/api/telemetry` | `LIVE API` |
| MQTT (any board) | Run a broker (e.g. `mosquitto`), set `VISTA_MQTT_HOST`; publish to `vistaspace/telemetry/<device>` | `LIVE HARDWARE` |
| No hardware | `VISTA_SIM_FALLBACK=true`. Emits only while no live source reports; `device_id` is `SIMULATOR` | `SIMULATED FALLBACK` |

On Linux, add yourself to the `dialout` group for serial access. A source counts as live for `VISTA_STALE_SECONDS`
(default 5 s) after its last reading. Temperatures above 30 °C ambient or 70 °C device raise a warning tagged with the
source.

## Testing

```bash
cd app && npm test                                   # gestures, debounce, posture thresholds/persistence, rules, command grammar
cd backend && pytest -q                              # API, source labelling, WebSocket stream, events CSV, detector honesty

# Hardware-data simulator: exercises the real ingest paths. It impersonates a device, so its data is labelled like one.
python backend/tools/device_simulator.py http --spike-at 8                  # → LIVE API (+ temperature alert)
python backend/tools/device_simulator.py serial --link /tmp/vista-serial   # then VISTA_SERIAL_PORT=/tmp/vista-serial → LIVE HARDWARE

# Vision without a webcam: Chrome fake camera fed with MediaPipe's test photos
python app/tools/make_fake_camera.py /tmp/fakecam.y4m
google-chrome --use-fake-device-for-media-stream --use-file-for-fake-video-capture=/tmp/fakecam.y4m http://localhost:5173
```

`dev/vision-harness.html` runs the vision engine alone and exposes `window.__events` and `window.__samples`. In the
console, `window.__vista.command("…")` sends text through exactly the same path as recognised speech (used by the
automated tests).

### What was verified while building this

- **Vision, in headless Chromium with a fake camera fed real photos.**
  - Landmarks and skeleton overlays drawn on the live video.
  - Left and right handedness checked against MediaPipe's left- and right-hand images.
  - Thumbs up, fist, open palm and pointing fired their actions.
  - A 25° rotated body raised attention and critical alerts, then returned to nominal.
  - S1 and S2 auto-completed from real pose detection.
  - EfficientDet (browser) and YOLOv8 (backend, with tracking IDs) detected the person.
  - OpenCV motion energy and contours worked.
- **Voice and procedure.** All 14 required voice commands executed through the speech handler. Unknown phrases are rejected.
- **Export.** JSON and CSV exports worked.
- **Camera states.** Denied, no camera, disconnected mid-session and unsupported each showed the right message.
- **Sensors.** WebSocket telemetry showed `SIMULATED FALLBACK` → `LIVE API` (HTTP device, with a temperature-spike alert) → `LIVE HARDWARE` (virtual serial port) → `DISCONNECTED` (backend stopped).
- **Not verifiable in that environment:**
  - real speech recognition (headless Chromium has no speech service, so the UI reports "did not start")
  - audible speech output (no voices installed; the app's `speechSynthesis.speak` calls were confirmed)
  - a physical webcam, an MQTT broker and physical sensors
  - GPU inference speed. On software-only WebGL the app switches MediaPipe to its CPU delegate (about 5–8 fps there); a normal laptop GPU is much faster.

## Code map

- `src/live/`: `camera.js` (lifecycle and errors), `vision.js` (MediaPipe, OpenCV worker, overlays), `gestures.js`, `posture.js`, `procedure.js` + `procedure.json`, `log.js` (mission log, CSV/JSON), `backend.js` (telemetry and detection WebSockets), `system.js`, `voice.js`, `commands.js`
- `src/console/`: the UI (`App.jsx` wires everything; `Monitor`, `Guidance`, `LeftColumn`, `RightColumn`, `VoiceConsole`, `TopBar`)
- `src/ds/`: VISTASpace design-system components; `public/workers/cv-worker.js`: the OpenCV.js worker
- `scripts/setup-assets.mjs`: copies WASM and OpenCV.js and downloads the models (runs before `dev` and `build`)
