// Unit tests for the pure vision logic. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHand, GestureStabilizer, GESTURE_CONFIG } from '../src/live/gestures.js';
import { computeMetrics, PostureMonitor, POSTURE_THRESHOLDS } from '../src/live/posture.js';
import { evaluateRule } from '../src/live/procedure.js';
import { parseCommand } from '../src/live/commands.js';

// ---- synthetic hand: wrist at bottom, fingers pointing up (normalized image coords)
function hand({ curl = [], pinch = false }) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[0] = { x: 0.5, y: 0.8, z: 0 };
  const bases = { 1: 0.40, 5: 0.45, 9: 0.5, 13: 0.55, 17: 0.6 };
  const splay = { 1: -0.1 }; // thumb angles outwards like a real hand
  for (const [b, x] of Object.entries(bases)) {
    const f = +b, curled = curl.includes(f);
    lm[f] = { x, y: 0.6, z: 0 }; lm[f + 1] = { x, y: 0.5, z: 0 };
    const sx = splay[f] || 0;
    lm[f + 2] = { x: x + sx * 0.6, y: curled ? 0.58 : 0.42, z: 0 }; lm[f + 3] = { x: x + sx, y: curled ? 0.65 : 0.35, z: 0 };
  }
  if (pinch) { lm[4] = { x: 0.455, y: 0.36, z: 0 }; lm[8] = { x: 0.45, y: 0.35, z: 0 }; }
  return lm;
}

test('pinch is detected from thumb-index distance', () => {
  const r = classifyHand(hand({ pinch: true }), { categoryName: 'Open_Palm', score: 0.8 });
  assert.equal(r.gesture, 'pinch'); assert.ok(r.score >= 0.6);
});
test('recognizer categories map to console gestures', () => {
  assert.equal(classifyHand(hand({}), { categoryName: 'Open_Palm', score: 0.9 }).gesture, 'open_palm');
  assert.equal(classifyHand(hand({ curl: [5, 9, 13, 17] }), { categoryName: 'Closed_Fist', score: 0.9 }).gesture, 'fist');
  assert.equal(classifyHand(hand({ curl: [5, 9, 13, 17] }), { categoryName: 'Thumb_Up', score: 0.8 }).gesture, 'thumbs_up');
});
test('pointing is detected geometrically in any direction', () => {
  assert.equal(classifyHand(hand({ curl: [9, 13, 17] }), { categoryName: 'None', score: 0.5 }).gesture, 'pointing');
});
test('stabilizer fires once after the hold time, then needs a release', () => {
  const s = new GestureStabilizer(); const hold = GESTURE_CONFIG.holdMs.thumbs_up;
  let fired = [];
  for (let t = 0; t <= hold + 100; t += 33) { const f = s.update('thumbs_up', 0.9, t); if (f) fired.push(t); }
  assert.equal(fired.length, 1); assert.ok(fired[0] >= hold);
  for (let t = hold + 100; t < hold + 5000; t += 33) assert.equal(s.update('thumbs_up', 0.9, t), null); // held: no repeat
  for (let t = 6000; t < 6400; t += 33) s.update(null, 0, t);                                          // release
  let again = null; for (let t = 6400; t < 7400; t += 33) again = again || s.update('thumbs_up', 0.9, t);
  assert.equal(again, 'thumbs_up');
});
test('low-confidence gestures never fire', () => {
  const s = new GestureStabilizer(); let f = null;
  for (let t = 0; t < 3000; t += 33) f = f || s.update('fist', 0.4, t);
  assert.equal(f, null);
});

// ---- synthetic pose (33 landmarks), upright, then rotated
function pose(rotDeg = 0) {
  const P = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  const set = (i, x, y) => { P[i] = { x, y, z: 0, visibility: 0.99 }; };
  set(0, 0.5, 0.2); set(2, 0.48, 0.18); set(5, 0.52, 0.18); set(7, 0.46, 0.2); set(8, 0.54, 0.2);
  set(11, 0.42, 0.32); set(12, 0.58, 0.32); set(13, 0.4, 0.45); set(14, 0.6, 0.45); set(23, 0.45, 0.6); set(24, 0.55, 0.6);
  const a = rotDeg * Math.PI / 180, cx = 0.5, cy = 0.45;
  return P.map(p => ({ ...p, x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a), y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a) }));
}
test('upright pose measures near zero', () => {
  const m = computeMetrics(pose(0), 1);
  assert.ok(m.headTilt < 1 && m.shoulderLevel < 1 && m.torsoLean < 1, JSON.stringify(m));
  assert.ok(m.armL < 20 && m.armR < 20);
});
test('posture escalates only after persistence, per threshold', () => {
  const mon = new PostureMonitor(); const T = POSTURE_THRESHOLDS;
  for (let t = 0; t <= 1200; t += 100) mon.update(computeMetrics(pose(0), 1), t);
  assert.equal(mon.level, 'nominal');
  const tilt = computeMetrics(pose(-25), 1); // 25° > critical 20° for shoulders
  let r;
  for (let t = 1300; t < 1300 + T.criticalHoldMs - 200; t += 100) r = mon.update(tilt, t);
  assert.equal(r.level, 'nominal', 'must not alert before criticalHoldMs');
  for (let t = 1300 + T.criticalHoldMs - 200; t <= 1300 + T.criticalHoldMs + 200; t += 100) r = mon.update(tilt, t);
  assert.equal(r.level, 'critical'); assert.ok(r.reasons.some(x => x.key === 'shoulderLevel'));
  const mild = computeMetrics(pose(-12), 1); // 12°: attention for shoulders (≥10) but below critical
  for (let t = 5000; t <= 5000 + T.attentionHoldMs + 200; t += 100) r = mon.update(mild, t);
  assert.equal(r.level, 'attention');
});
test('calibration makes metrics relative to the neutral posture', () => {
  const mon = new PostureMonitor(); const base = computeMetrics(pose(-12), 1);
  mon.calibrate(base);
  let r; for (let t = 0; t <= 1500; t += 100) r = mon.update(base, t);
  assert.equal(r.level, 'nominal');
});
test('low visibility is "unknown", never nominal', () => {
  const mon = new PostureMonitor(); const lm = pose(0).map(p => ({ ...p, visibility: 0.2 }));
  let r; for (let t = 0; t <= 1500; t += 100) r = mon.update(computeMetrics(lm, 1), t);
  assert.equal(r.level, 'unknown');
});

test('object rule is blocked when no detector is available', () => {
  const r = evaluateRule({ type: 'object_present', label: 'bottle', minConf: 0.5, seconds: 1 }, { monitoring: true, detectorAvailable: false });
  assert.equal(r.ok, false); assert.match(r.blocked, /unavailable/);
  const ok = evaluateRule({ type: 'object_present', label: 'bottle', minConf: 0.5, seconds: 1 }, { monitoring: true, detectorAvailable: true, detections: [{ label: 'bottle', conf: 0.7 }] });
  assert.equal(ok.ok, true);
});
test('required voice phrases parse to commands', () => {
  for (const [p, c] of [['Start monitoring', 'start_monitoring'], ['Stop monitoring', 'stop_monitoring'], ['Enable hand tracking', 'hands_on'], ['Disable hand tracking', 'hands_off'],
    ['What is my posture status?', 'posture_status'], ['Read current procedure', 'read_procedure'], ['Next step', 'next_step'], ['Previous step', 'prev_step'], ['Repeat instruction', 'repeat'],
    ['Mute alerts', 'mute_alerts'], ['Unmute alerts', 'unmute_alerts'], ['Show temperature', 'temperature'], ['Show system health', 'system_health'], ['Mark step complete', 'complete_step']])
    assert.equal(parseCommand(p), c, p);
});
