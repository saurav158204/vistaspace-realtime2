/*
 * Posture analysis from MediaPipe Pose landmarks (image coordinates, aspect-corrected).
 *
 * Metrics (degrees unless noted):
 *   headTilt       roll of the ear line (eye line if ears are hidden) against horizontal
 *   neck           lean of shoulder-midpoint → ear-midpoint against vertical
 *   shoulderLevel  angle of the shoulder line against horizontal
 *   torsoLean      lean of hip-midpoint → shoulder-midpoint against vertical (needs hips in view)
 *   armL / armR    arm elevation: 0 = arm down along the torso, 90 = horizontal, 180 = overhead
 *   visibility     mean landmark visibility of head + shoulders (+ hips when visible), 0..1
 *
 * After "Calibrate", head/neck/shoulder/torso are measured relative to the crew member's own neutral posture.
 * Angles are 2D (camera plane), so place the camera level and facing the person. PROTOTYPE AID ONLY — not a medical,
 * ergonomic, safety-certified or flight-certified assessment.
 */

export const POSTURE_THRESHOLDS = {
  headTilt: { attention: 15, critical: 30, label: 'Head tilt' },
  neck: { attention: 20, critical: 35, label: 'Neck alignment' },
  shoulderLevel: { attention: 10, critical: 20, label: 'Shoulder level' },
  torsoLean: { attention: 15, critical: 30, label: 'Torso lean' },
  arm: { attention: 150, critical: null, label: 'Arm elevation' }, // sustained overhead reach
  minVisibility: 0.55,        // below this the posture is "not assessed"
  attentionHoldMs: 2000,      // a condition must persist this long before the level escalates
  criticalHoldMs: 1500,
  recoverHoldMs: 1000,
};

const DEG = 180 / Math.PI;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const vis = p => (p && p.visibility != null ? p.visibility : 0);

// Angle of vector v against horizontal, folded to 0..90.
const fromHorizontal = v => { let a = Math.abs(Math.atan2(v.y, v.x) * DEG); if (a > 90) a = 180 - a; return a; };
// Signed angle of an upward vector against vertical (+ = leaning to image right).
const fromVertical = v => Math.atan2(v.x, -v.y) * DEG;
const angleBetween = (u, v) => {
  const c = (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) || 1e-6);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
};

export function computeMetrics(lm, aspect) {
  if (!lm || lm.length < 25) return null;
  const P = i => ({ x: lm[i].x * aspect, y: lm[i].y, v: vis(lm[i]) });
  const nose = P(0), eyeL = P(2), eyeR = P(5), earL = P(7), earR = P(8), shL = P(11), shR = P(12), elL = P(13), elR = P(14), hipL = P(23), hipR = P(24);
  const headPts = earL.v > 0.5 && earR.v > 0.5 ? [earL, earR] : [eyeL, eyeR];
  const hipsOk = hipL.v > 0.5 && hipR.v > 0.5;
  const shMid = mid(shL, shR);
  const head = earL.v > 0.5 && earR.v > 0.5 ? mid(earL, earR) : nose;
  const hipMid = hipsOk ? mid(hipL, hipR) : null;
  const down = hipMid ? { x: hipMid.x - shMid.x, y: hipMid.y - shMid.y } : { x: 0, y: 1 };
  const keys = [nose, earL, earR, shL, shR].concat(hipsOk ? [hipL, hipR] : []);
  const armAngle = (sh, el) => (sh.v > 0.5 && el.v > 0.5 ? angleBetween({ x: el.x - sh.x, y: el.y - sh.y }, down) : null);
  return {
    headTilt: fromHorizontal({ x: headPts[1].x - headPts[0].x, y: headPts[1].y - headPts[0].y }),
    headTiltSigned: Math.atan2(headPts[1].y - headPts[0].y, headPts[1].x - headPts[0].x) * DEG,
    neck: fromVertical({ x: head.x - shMid.x, y: head.y - shMid.y }),
    shoulderLevel: fromHorizontal({ x: shR.x - shL.x, y: shR.y - shL.y }),
    shoulderSigned: Math.atan2(shR.y - shL.y, shR.x - shL.x) * DEG,
    torsoLean: hipMid ? fromVertical({ x: shMid.x - hipMid.x, y: shMid.y - hipMid.y }) : null,
    armL: armAngle(shL, elL),
    armR: armAngle(shR, elR),
    visibility: keys.reduce((s, p) => s + p.v, 0) / keys.length,
  };
}

// Deviations used for classification (relative to the calibration baseline if one is set).
export function deviations(m, baseline) {
  if (!m) return null;
  const b = baseline || {};
  const rel = (k, signedKey) => {
    if (m[k] == null) return null;
    if (b[signedKey || k] == null) return Math.abs(m[k]);
    if (signedKey) { let d = Math.abs(m[signedKey] - b[signedKey]); if (d > 180) d = 360 - d; if (d > 90) d = 180 - d; return d; }
    return Math.abs(m[k] - b[k]);
  };
  return {
    headTilt: rel('headTilt', 'headTiltSigned'),
    neck: rel('neck'),
    shoulderLevel: rel('shoulderLevel', 'shoulderSigned'),
    torsoLean: rel('torsoLean'),
    arm: Math.max(m.armL || 0, m.armR || 0) || null,
  };
}

function levelOf(dev) {
  const T = POSTURE_THRESHOLDS; const reasons = []; let level = 'nominal';
  for (const k of ['headTilt', 'neck', 'shoulderLevel', 'torsoLean', 'arm']) {
    const v = dev[k]; if (v == null) continue;
    if (T[k].critical != null && v >= T[k].critical) { level = 'critical'; reasons.push({ key: k, value: v, level: 'critical' }); }
    else if (v >= T[k].attention) { if (level !== 'critical') level = 'attention'; reasons.push({ key: k, value: v, level: 'attention' }); }
  }
  return { level, reasons };
}

// Stateful classifier with persistence, so a single noisy frame never raises an alert.
export class PostureMonitor {
  constructor() { this.level = 'unknown'; this.pending = null; this.pendingSince = 0; this.baseline = null; this.last = null; }

  calibrate(m) {
    if (!m) return false;
    this.baseline = { headTiltSigned: m.headTiltSigned, neck: m.neck, shoulderSigned: m.shoulderSigned, torsoLean: m.torsoLean };
    return true;
  }

  // → { level, changed, reasons, metrics, dev }
  update(metrics, now) {
    const T = POSTURE_THRESHOLDS;
    let target, reasons = [], dev = null;
    if (!metrics || metrics.visibility < T.minVisibility) target = 'unknown';
    else { dev = deviations(metrics, this.baseline); ({ level: target, reasons } = levelOf(dev)); }
    if (target !== this.pending) { this.pending = target; this.pendingSince = now; }
    const hold = target === 'critical' ? T.criticalHoldMs : target === 'attention' ? T.attentionHoldMs : T.recoverHoldMs;
    let changed = false;
    if (target !== this.level && now - this.pendingSince >= hold) { this.level = target; changed = true; }
    this.last = { level: this.level, reasons, metrics, dev };
    return { ...this.last, changed };
  }
}
