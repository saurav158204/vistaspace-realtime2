/*
 * Gesture classification from MediaPipe hand landmarks + the GestureRecognizer's own categories.
 *
 * Gestures used by the console:
 *   open_palm  → show / confirm monitoring status      (recognizer: Open_Palm)
 *   fist       → pause / resume monitoring             (recognizer: Closed_Fist)
 *   thumbs_up  → confirm the current procedure step    (recognizer: Thumb_Up)
 *   pointing   → highlight / select a detected target  (recognizer: Pointing_Up, or index extended in any direction)
 *   pinch      → configurable action                   (thumb tip ↔ index tip distance, computed here)
 *
 * A gesture only fires after it is held steadily (holdMs) above minScore, then it must be released before it can fire
 * again, and each gesture has a cooldown. This keeps one deliberate gesture = one action.
 */

export const GESTURES = {
  open_palm: { label: 'Open palm', hi: 'खुली हथेली' },
  fist: { label: 'Closed fist', hi: 'मुट्ठी' },
  thumbs_up: { label: 'Thumbs up', hi: 'अंगूठा ऊपर' },
  pointing: { label: 'Pointing', hi: 'इशारा' },
  pinch: { label: 'Pinch', hi: 'चुटकी' },
};

export const GESTURE_CONFIG = {
  minScore: 0.6,          // minimum classifier confidence
  holdMs: { open_palm: 600, fist: 700, thumbs_up: 600, pointing: 400, pinch: 350 },
  cooldownMs: 2000,       // per gesture, after it fires
  releaseMs: 250,         // gesture must be absent this long before it can fire again
  pinchRatio: 0.22,       // thumb-index distance / palm size below which the hand is pinching
};

const MAP = { Open_Palm: 'open_palm', Closed_Fist: 'fist', Thumb_Up: 'thumbs_up', Pointing_Up: 'pointing' };

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const extended = (lm, tip, pip) => d2(lm[tip], lm[0]) > d2(lm[pip], lm[0]) * 1.12;
const curled = (lm, tip, pip) => d2(lm[tip], lm[0]) < d2(lm[pip], lm[0]) * 1.02;

// → { gesture: id|null, score, raw: recognizer category, pinchRatio }
export function classifyHand(lm, category) {
  const palm = d2(lm[0], lm[9]) || 1e-6;
  const pinchRatio = d2(lm[4], lm[8]) / palm;
  const cat = category ? category.categoryName : 'None';
  const catScore = category ? category.score : 0;
  if (pinchRatio < GESTURE_CONFIG.pinchRatio && cat !== 'Closed_Fist' && !curled(lm, 8, 6)) {
    return { gesture: 'pinch', score: Math.min(0.99, 0.6 + 0.4 * (1 - pinchRatio / GESTURE_CONFIG.pinchRatio)), raw: cat, pinchRatio };
  }
  if (MAP[cat] && catScore >= 0.3) return { gesture: MAP[cat], score: catScore, raw: cat, pinchRatio };
  if (extended(lm, 8, 6) && curled(lm, 12, 10) && curled(lm, 16, 14) && curled(lm, 20, 18)) {
    return { gesture: 'pointing', score: 0.75, raw: cat, pinchRatio };
  }
  return { gesture: null, score: catScore, raw: cat, pinchRatio };
}

export function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  return { x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length, y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length };
}

// One stabilizer per hand side ("Left" / "Right").
export class GestureStabilizer {
  constructor() { this.cand = null; this.since = 0; this.scores = []; this.lastFire = {}; this.armed = {}; this.absentSince = {}; }

  // Returns a gesture id when it should fire this frame, else null.
  update(gesture, score, now) {
    const C = GESTURE_CONFIG;
    for (const g of Object.keys(GESTURES)) {
      if (g !== gesture) {
        if (this.absentSince[g] == null) this.absentSince[g] = now;
        if (now - this.absentSince[g] >= C.releaseMs) this.armed[g] = true;
      } else this.absentSince[g] = null;
    }
    if (gesture !== this.cand) { this.cand = gesture; this.since = now; this.scores = []; }
    if (!gesture) return null;
    this.scores.push(score);
    if (this.scores.length > 30) this.scores.shift();
    const avg = this.scores.reduce((a, b) => a + b, 0) / this.scores.length;
    const armed = this.armed[gesture] !== false;
    if (armed && avg >= C.minScore && now - this.since >= C.holdMs[gesture] && now - (this.lastFire[gesture] || -1e9) >= C.cooldownMs) {
      this.lastFire[gesture] = now; this.armed[gesture] = false;
      return gesture;
    }
    return null;
  }

  heldFraction(now) {
    if (!this.cand) return 0;
    return Math.min(1, (now - this.since) / GESTURE_CONFIG.holdMs[this.cand]);
  }
}

// Pointing target: the detected box hit first by the ray from the index knuckle through the fingertip (normalized coords).
export function pointTarget(lm, boxes) {
  const a = lm[5], b = lm[8];
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / n, uy = dy / n;
  let best = null;
  for (const bx of boxes) {
    for (let t = 0; t <= 1.5; t += 0.01) {
      const x = b.x + ux * t, y = b.y + uy * t;
      if (x >= bx.box[0] && x <= bx.box[0] + bx.box[2] && y >= bx.box[1] && y <= bx.box[1] + bx.box[3]) {
        if (!best || t < best.t) best = { t, target: bx };
        break;
      }
    }
  }
  return { tip: { x: b.x, y: b.y }, dir: { x: ux, y: uy }, target: best ? best.target : null };
}
