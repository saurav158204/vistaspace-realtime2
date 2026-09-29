import { FilesetResolver, GestureRecognizer, PoseLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';
import { classifyHand, palmCenter, GestureStabilizer, pointTarget } from './gestures.js';
import { computeMetrics, PostureMonitor } from './posture.js';

/*
 * Real-time vision engine. Everything here runs on real camera frames in the browser:
 *   MediaPipe GestureRecognizer  → 21 hand landmarks ×2, left/right, gesture category
 *   MediaPipe PoseLandmarker     → 33 body landmarks → posture metrics
 *   MediaPipe ObjectDetector     → EfficientDet-Lite0 (COCO) boxes, optional ("browser" object source)
 *   OpenCV.js (worker)           → frame differencing, motion energy, contours
 * Overlays are drawn straight to a canvas every frame; React reads `latest` a few times per second.
 */

const BASE = import.meta.env.BASE_URL;
const MODELS = {
  hands: BASE + 'models/gesture_recognizer.task',
  pose: BASE + 'models/pose_landmarker_lite.task',
  objects: BASE + 'models/efficientdet_lite0.tflite',
};

// We feed the raw, un-mirrored camera frame; tasks-vision then reports the person's actual hand.
// Verified with MediaPipe's right_hands.jpg → Right/Right and left_hands.jpg → Left/Left (dev/hand-check.html).
const SWAP_HANDEDNESS = false;

const HAND_BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const POSE_BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [0, 7], [0, 8], [7, 11], [8, 12]];
const AMBER = '#FF8A1F', RED = '#FF3B3B', GREEN = '#2BD67B';

// ?delegate=cpu|gpu forces a delegate (useful on machines whose WebGL is software-emulated).
const FORCE = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('delegate') || '').toUpperCase() : '';

// Software-emulated WebGL (SwiftShader / llvmpipe) makes the GPU delegate ~20× slower than CPU, so use CPU there.
function softwareGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(r);
  } catch { return true; }
}
const PREFERRED = FORCE === 'CPU' || FORCE === 'GPU' ? FORCE : (typeof document !== 'undefined' && softwareGL() ? 'CPU' : 'GPU');

async function create(Klass, fileset, options) {
  if (PREFERRED === 'CPU' || FORCE === 'GPU') return { task: await Klass.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: PREFERRED } }), delegate: PREFERRED };
  try { return { task: await Klass.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } }), delegate: 'GPU' }; }
  catch (e) { return { task: await Klass.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } }), delegate: 'CPU' }; }
}

export class VisionEngine {
  constructor({ onStatus, onGesture, onPosture, onMotionReady }) {
    this.cb = { onStatus, onGesture, onPosture, onMotionReady };
    this.fileset = null;
    this.tasks = {}; this.delegate = {};
    this.status = { hands: 'off', pose: 'off', objects: 'off', motion: 'off' };
    this.errors = {};
    this.opts = { hands: true, pose: true, objects: 'off', motion: true, mirror: true };
    this.paused = false;
    this.running = false;
    this.video = null; this.canvas = null;
    this.stab = { Left: new GestureStabilizer(), Right: new GestureStabilizer() };
    this.posture = new PostureMonitor();
    this.latest = this.emptyLatest();
    this.frameTimes = [];
    this.frameNo = 0;
    this.backendDetections = { at: 0, list: [] };
    this.browserDetections = { at: 0, list: [] };
    this.motion = { energy: 0, contours: [], ms: 0, at: 0 };
    this.worker = null; this.small = null;
    this.trail = { Left: [], Right: [] }; // palm centres in display coordinates, for the trajectory panel
  }

  emptyLatest() {
    return { fps: 0, inferenceMs: 0, ms: { hands: 0, pose: 0, objects: 0 }, hands: [], pose: null, posture: { level: 'unknown', reasons: [] }, pointing: null, frame: 0, video: null };
  }

  setStatus(k, v, err) { this.status[k] = v; if (err) this.errors[k] = err; else delete this.errors[k]; this.cb.onStatus && this.cb.onStatus({ ...this.status }, { ...this.errors }, { ...this.delegate }); }

  async ensureFileset() {
    if (!this.fileset) this.fileset = await FilesetResolver.forVisionTasks(BASE + 'mediapipe');
    return this.fileset;
  }

  async loadTask(kind) {
    if (this.tasks[kind] || this.status[kind] === 'loading') return;
    this.setStatus(kind, 'loading');
    try {
      const fs = await this.ensureFileset();
      let r;
      if (kind === 'hands') r = await create(GestureRecognizer, fs, { baseOptions: { modelAssetPath: MODELS.hands }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      if (kind === 'pose') r = await create(PoseLandmarker, fs, { baseOptions: { modelAssetPath: MODELS.pose }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      if (kind === 'objects') r = await create(ObjectDetector, fs, { baseOptions: { modelAssetPath: MODELS.objects }, runningMode: 'VIDEO', scoreThreshold: 0.4, maxResults: 8 });
      this.tasks[kind] = r.task; this.delegate[kind] = r.delegate;
      this.setStatus(kind, 'ready');
    } catch (e) {
      this.setStatus(kind, 'error', String(e && e.message || e));
    }
  }

  async load() {
    await Promise.all([this.opts.hands && this.loadTask('hands'), this.opts.pose && this.loadTask('pose'), this.opts.objects === 'browser' && this.loadTask('objects')]);
  }

  setOptions(o) {
    this.opts = { ...this.opts, ...o };
    if (this.opts.hands && !this.tasks.hands) this.loadTask('hands');
    if (this.opts.pose && !this.tasks.pose) this.loadTask('pose');
    if (this.opts.objects === 'browser' && !this.tasks.objects) this.loadTask('objects');
    if (!this.opts.hands) { this.latest.hands = []; this.latest.pointing = null; }
    if (!this.opts.pose) { this.latest.pose = null; }
    if (this.opts.motion && this.running && !this.worker) this.startWorker();
    if (!this.opts.motion && this.worker) this.stopWorker();
  }

  startWorker() {
    try {
      this.setStatus('motion', 'loading');
      this.worker = new Worker(BASE + 'workers/cv-worker.js');
      this.worker.onmessage = e => {
        const m = e.data;
        if (m.type === 'ready') { this.setStatus('motion', 'ready'); this.cb.onMotionReady && this.cb.onMotionReady(m.version); }
        else if (m.type === 'motion') this.motion = { energy: m.energy, contours: m.contours, ms: m.ms, at: performance.now() };
        else if (m.type === 'error') this.setStatus('motion', 'error', m.error);
      };
      this.worker.onerror = e => this.setStatus('motion', 'error', e.message || 'worker failed');
      this.small = document.createElement('canvas'); this.small.width = 160; this.small.height = 90;
    } catch (e) { this.setStatus('motion', 'error', String(e)); }
  }

  stopWorker() { if (this.worker) this.worker.terminate(); this.worker = null; this.motion = { energy: 0, contours: [], ms: 0, at: 0 }; this.setStatus('motion', 'off'); }

  start(video, canvas) {
    this.video = video; this.canvas = canvas; this.running = true; this.frameTimes = []; this.lastVideoTime = -1;
    this.posture = new PostureMonitor(); this.posture.baseline = this.baseline || null;
    if (this.opts.motion) this.startWorker();
    this.load();
    const loop = () => {
      if (!this.running) return;
      try { this.tick(); } catch (e) { this.errors.loop = String(e && e.message || e); }
      this.handle = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    };
    this.handle = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.video && this.video.cancelVideoFrameCallback && this.handle) this.video.cancelVideoFrameCallback(this.handle); else cancelAnimationFrame(this.handle);
    this.stopWorker();
    const c = this.canvas; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    this.latest = this.emptyLatest();
  }

  calibrate() { const ok = this.posture.calibrate(this.latest.pose && this.latest.pose.metrics); if (ok) this.baseline = this.posture.baseline; return ok; }
  clearCalibration() { this.baseline = null; this.posture.baseline = null; }

  tick() {
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    if (v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const now = performance.now();
    this.frameNo++;
    this.frameTimes.push(now); while (this.frameTimes.length && now - this.frameTimes[0] > 1000) this.frameTimes.shift();
    const L = this.latest; L.frame = this.frameNo; L.fps = this.frameTimes.length; L.video = { w: v.videoWidth, h: v.videoHeight };
    const aspect = v.videoWidth / v.videoHeight;
    let total = 0;

    // hands + gestures (kept running while paused so a fist can resume)
    if (this.opts.hands && this.tasks.hands) {
      const t0 = performance.now();
      const r = this.tasks.hands.recognizeForVideo(v, now);
      L.ms.hands = performance.now() - t0; total += L.ms.hands;
      L.hands = (r.landmarks || []).map((lm, i) => {
        const hd = r.handedness[i] && r.handedness[i][0];
        let side = hd ? hd.categoryName : 'Right';
        if (SWAP_HANDEDNESS) side = side === 'Left' ? 'Right' : 'Left';
        const c = classifyHand(lm, r.gestures[i] && r.gestures[i][0]);
        return { side, handScore: hd ? hd.score : 0, landmarks: lm, gesture: c.gesture, score: c.score, raw: c.raw, center: palmCenter(lm) };
      });
      for (const side of ['Left', 'Right']) {
        const h = L.hands.filter(x => x.side === side).sort((a, b) => b.score - a.score)[0];
        const fired = this.stab[side].update(h ? h.gesture : null, h ? h.score : 0, now);
        if (h) h.hold = this.stab[side].heldFraction(now);
        if (fired && (!this.paused || fired === 'fist' || fired === 'open_palm')) {
          const pos = this.displayPoint(h.center);
          const evt = { gesture: fired, side, score: h.score, x: pos.x, y: pos.y, at: Date.now() };
          if (fired === 'pointing') { const p = pointTarget(h.landmarks, this.allDetections()); evt.target = p.target; }
          this.cb.onGesture && this.cb.onGesture(evt);
        }
      }
      for (const h of L.hands) { const q = this.displayPoint(h.center); this.trail[h.side].push({ t: now, x: q.x, y: q.y }); if (this.trail[h.side].length > 200) this.trail[h.side].shift(); }
      const pointer = L.hands.find(h => h.gesture === 'pointing');
      L.pointing = pointer ? { side: pointer.side, ...pointTarget(pointer.landmarks, this.allDetections()) } : null;
    }

    if (!this.paused) {
      if (this.opts.pose && this.tasks.pose) {
        const t0 = performance.now();
        const r = this.tasks.pose.detectForVideo(v, now);
        L.ms.pose = performance.now() - t0; total += L.ms.pose;
        const lm = r.landmarks && r.landmarks[0];
        const metrics = lm ? computeMetrics(lm, aspect) : null;
        const res = this.posture.update(metrics, now);
        L.pose = lm ? { landmarks: lm, metrics } : null;
        L.posture = { level: res.level, reasons: res.reasons, dev: res.dev };
        if (res.changed) this.cb.onPosture && this.cb.onPosture({ level: res.level, reasons: res.reasons, metrics });
      }
      if (this.opts.objects === 'browser' && this.tasks.objects && this.frameNo % 5 === 0) {
        const t0 = performance.now();
        const r = this.tasks.objects.detectForVideo(v, now);
        L.ms.objects = performance.now() - t0; total += L.ms.objects;
        this.browserDetections = { at: now, list: r.detections.map((d, i) => ({ id: i + 1, label: d.categories[0].categoryName, conf: d.categories[0].score,
          box: [d.boundingBox.originX / v.videoWidth, d.boundingBox.originY / v.videoHeight, d.boundingBox.width / v.videoWidth, d.boundingBox.height / v.videoHeight] })) };
      }
      if (this.worker && this.status.motion === 'ready' && this.frameNo % 2 === 0) {
        const cx = this.small.getContext('2d', { willReadFrequently: true });
        cx.drawImage(v, 0, 0, 160, 90);
        const img = cx.getImageData(0, 0, 160, 90);
        this.worker.postMessage({ type: 'frame', id: this.frameNo, width: 160, height: 90, buffer: img.data.buffer }, [img.data.buffer]);
      }
    }
    if (total) L.inferenceMs = L.inferenceMs ? L.inferenceMs * 0.8 + total * 0.2 : total;
    this.draw();
  }

  allDetections() {
    const now = performance.now();
    if (this.opts.objects === 'backend' && now - this.backendDetections.at < 1500) return this.backendDetections.list;
    if (this.opts.objects === 'browser' && now - this.browserDetections.at < 1500) return this.browserDetections.list;
    return [];
  }

  displayPoint(p) { return { x: this.opts.mirror ? 1 - p.x : p.x, y: p.y }; }

  draw() {
    const c = this.canvas; if (!c) return;
    const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const X = x => (this.opts.mirror ? 1 - x : x) * W, Y = y => y * H;
    const L = this.latest;
    const crit = L.posture.level === 'critical', att = L.posture.level === 'attention';

    // motion contours (OpenCV)
    if (this.opts.motion && performance.now() - this.motion.at < 500) {
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([3, 4]); g.lineWidth = 1;
      for (const b of this.motion.contours) { const x0 = X(b.x), x1 = X(b.x + b.w); g.strokeRect(Math.min(x0, x1), Y(b.y), Math.abs(x1 - x0), b.h * H); }
      g.setLineDash([]);
    }
    // objects
    const targetId = L.pointing && L.pointing.target ? L.pointing.target.id + L.pointing.target.label : null;
    g.font = '600 11px "JetBrains Mono", monospace';
    for (const d of this.allDetections()) {
      const x0 = X(d.box[0]), x1 = X(d.box[0] + d.box[2]), bx = Math.min(x0, x1), bw = Math.abs(x1 - x0), by = Y(d.box[1]), bh = d.box[3] * H;
      const hot = targetId === d.id + d.label; const col = hot ? AMBER : '#fff';
      g.strokeStyle = col; g.lineWidth = hot ? 2 : 1; g.strokeRect(bx, by, bw, bh);
      const txt = (d.label + (d.id != null ? ' #' + d.id : '') + ' ' + d.conf.toFixed(2)).toUpperCase();
      const tw = g.measureText(txt).width + 6; g.fillStyle = col; g.fillRect(bx - 1, by - 15, tw, 14); g.fillStyle = '#000'; g.fillText(txt, bx + 2, by - 4);
    }
    // pose skeleton
    if (L.pose) {
      const lm = L.pose.landmarks; const col = crit ? RED : att ? AMBER : '#fff';
      g.strokeStyle = col; g.lineWidth = 2; g.globalAlpha = .85;
      for (const [a, b] of POSE_BONES) { if ((lm[a].visibility || 0) < .5 || (lm[b].visibility || 0) < .5) continue; g.beginPath(); g.moveTo(X(lm[a].x), Y(lm[a].y)); g.lineTo(X(lm[b].x), Y(lm[b].y)); g.stroke(); }
      g.fillStyle = '#000';
      for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) { if ((lm[i].visibility || 0) < .5) continue; g.beginPath(); g.arc(X(lm[i].x), Y(lm[i].y), 3.5, 0, 7); g.fill(); g.stroke(); }
      g.globalAlpha = 1;
    }
    // hands
    for (const h of L.hands) {
      const lm = h.landmarks; const col = h.gesture ? AMBER : '#fff';
      g.strokeStyle = col; g.lineWidth = 1.5;
      for (const [a, b] of HAND_BONES) { g.beginPath(); g.moveTo(X(lm[a].x), Y(lm[a].y)); g.lineTo(X(lm[b].x), Y(lm[b].y)); g.stroke(); }
      g.fillStyle = col; for (const p of lm) g.fillRect(X(p.x) - 2, Y(p.y) - 2, 4, 4);
      const wx = X(lm[0].x), wy = Y(lm[0].y) + 18;
      const txt = (h.side + ' · ' + (h.gesture ? h.gesture.replace('_', ' ') + ' ' + h.score.toFixed(2) : 'tracked ' + h.handScore.toFixed(2))).toUpperCase();
      const tw = g.measureText(txt).width + 10;
      g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(wx - tw / 2, wy - 11, tw, 17); g.strokeStyle = col; g.lineWidth = 1; g.strokeRect(wx - tw / 2 + .5, wy - 10.5, tw - 1, 16);
      g.fillStyle = col; g.textAlign = 'center'; g.fillText(txt, wx, wy + 1); g.textAlign = 'left';
      if (h.gesture && h.hold < 1) { g.strokeStyle = AMBER; g.lineWidth = 2; g.beginPath(); g.arc(X(h.center.x), Y(h.center.y), 16, -Math.PI / 2, -Math.PI / 2 + h.hold * Math.PI * 2); g.stroke(); }
    }
    // pointing ray
    if (L.pointing) {
      const p = L.pointing; g.strokeStyle = AMBER; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(p.tip.x), Y(p.tip.y));
      g.lineTo(X(p.tip.x + p.dir.x * 0.6), Y(p.tip.y + p.dir.y * 0.6)); g.stroke(); g.setLineDash([]);
    }
    void GREEN;
  }

  // JPEG of the current frame (as displayed, with overlays) for evidence records.
  snapshot(width = 480) {
    const v = this.video; if (!v || !v.videoWidth) return null;
    const h = Math.round(width * v.videoHeight / v.videoWidth);
    const c = document.createElement('canvas'); c.width = width; c.height = h;
    const g = c.getContext('2d');
    if (this.opts.mirror) { g.translate(width, 0); g.scale(-1, 1); }
    g.drawImage(v, 0, 0, width, h);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.canvas && this.canvas.width) g.drawImage(this.canvas, 0, 0, width, h);
    try { return c.toDataURL('image/jpeg', 0.72); } catch { return null; }
  }

  // Raw frame (un-mirrored) as JPEG for the backend detector.
  grabJpeg(maxW = 640) {
    const v = this.video; if (!v || !v.videoWidth) return Promise.resolve(null);
    const w = Math.min(maxW, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
    if (!this.grab) this.grab = document.createElement('canvas');
    this.grab.width = w; this.grab.height = h; this.grab.getContext('2d').drawImage(v, 0, 0, w, h);
    return new Promise(res => this.grab.toBlob(res, 'image/jpeg', 0.7));
  }
}
