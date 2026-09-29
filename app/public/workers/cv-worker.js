/* OpenCV.js motion analysis worker.
 * In:  {type:'frame', id, width, height, buffer}  (RGBA pixels of a downscaled frame, transferred)
 * Out: {type:'ready'} once OpenCV is initialised, then per frame:
 *      {type:'motion', id, energy, contours:[{x,y,w,h,area}], ms}   (all coordinates normalised 0..1)
 * Motion = |frame − previous| on blurred greyscale → threshold → dilate → external contours.
 */
/* global cv */
let ready = false, prev = null, busy = false;
const MIN_AREA = 0.004; // ignore contours smaller than 0.4 % of the frame

function init() {
  ready = true;
  postMessage({ type: 'ready', version: cv.getBuildInformation ? (cv.getBuildInformation().match(/Version control:\s*(\S+)/) || [])[1] || '' : '' });
}

try {
  importScripts('../vendor/opencv.js');
  if (typeof cv === 'undefined') throw new Error('cv missing');
  if (cv instanceof Promise || typeof cv.then === 'function') cv.then(m => { self.cv = m; init(); });
  else if (cv.Mat) init();
  else cv.onRuntimeInitialized = init;
} catch (e) {
  postMessage({ type: 'error', error: String(e && e.message || e) });
}

onmessage = e => {
  const m = e.data;
  if (m.type === 'reset') { if (prev) { prev.delete(); prev = null; } return; }
  if (m.type !== 'frame' || !ready || busy) return;
  busy = true;
  const t0 = performance.now();
  const { width: w, height: h } = m;
  const src = cv.matFromImageData(new ImageData(new Uint8ClampedArray(m.buffer), w, h));
  const gray = new cv.Mat(), diff = new cv.Mat(), mask = new cv.Mat(), hier = new cv.Mat(), contours = new cv.MatVector();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    let energy = 0; const boxes = [];
    if (prev && prev.rows === h && prev.cols === w) {
      cv.absdiff(gray, prev, diff);
      cv.threshold(diff, mask, 25, 255, cv.THRESH_BINARY);
      const k = cv.Mat.ones(3, 3, cv.CV_8U);
      cv.dilate(mask, mask, k, new cv.Point(-1, -1), 2);
      k.delete();
      energy = cv.countNonZero(mask) / (w * h);
      cv.findContours(mask, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const area = cv.contourArea(c) / (w * h);
        if (area >= MIN_AREA) { const r = cv.boundingRect(c); boxes.push({ x: r.x / w, y: r.y / h, w: r.width / w, h: r.height / h, area }); }
        c.delete();
      }
      boxes.sort((a, b) => b.area - a.area);
    }
    if (prev) prev.delete();
    prev = gray.clone();
    postMessage({ type: 'motion', id: m.id, energy, contours: boxes.slice(0, 8), ms: performance.now() - t0 });
  } catch (err) {
    postMessage({ type: 'error', error: String(err && err.message || err) });
  } finally {
    src.delete(); gray.delete(); diff.delete(); mask.delete(); hier.delete(); contours.delete();
    busy = false;
  }
};
