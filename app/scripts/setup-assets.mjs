// Copies MediaPipe WASM + OpenCV.js into public/ and downloads the MediaPipe models once.
// Runs automatically before `npm run dev` / `npm run build`. Safe to re-run; existing files are kept.
import { mkdirSync, existsSync, copyFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pub = join(root, 'public');
const MODELS = {
  'gesture_recognizer.task': 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  'pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  'efficientdet_lite0.tflite': 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
};

for (const d of ['mediapipe', 'models', 'vendor']) mkdirSync(join(pub, d), { recursive: true });

const wasmDir = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
for (const f of readdirSync(wasmDir)) copyFileSync(join(wasmDir, f), join(pub, 'mediapipe', f));
copyFileSync(join(root, 'node_modules/@techstark/opencv-js/dist/opencv.js'), join(pub, 'vendor', 'opencv.js'));

for (const [name, url] of Object.entries(MODELS)) {
  const dest = join(pub, 'models', name);
  if (existsSync(dest) && statSync(dest).size > 100000) continue;
  process.stdout.write(`downloading ${name} … `);
  const res = await fetch(url);
  if (!res.ok) { console.error(`failed (${res.status}). Download it manually from ${url} into public/models/`); process.exitCode = 1; continue; }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('ok');
}
