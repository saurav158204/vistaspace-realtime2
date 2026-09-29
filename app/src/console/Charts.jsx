import React, { useRef, useEffect, useState } from 'react';

// rAF while visible; throttle to a few fps when the tab is hidden.
export const sched = cb => (document.hidden ? { t: setTimeout(() => cb(performance.now()), 400) } : { r: requestAnimationFrame(cb) });
export const unsched = h => { if (!h) return; if (h.t) clearTimeout(h.t); if (h.r) cancelAnimationFrame(h.r); };
const rnd = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

export function RafCanvas({ width, height, draw, style }) {
  const ref = useRef(null); const fn = useRef(draw); fn.current = draw;
  useEffect(() => {
    const c = ref.current, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr; c.height = height * dpr; const ctx = c.getContext('2d');
    let raf; const t0 = performance.now();
    const loop = now => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.globalAlpha = 1; fn.current(ctx, (now - t0) / 1000, width, height); raf = sched(loop); };
    raf = sched(loop); return () => unsched(raf);
  }, [width, height]);
  return <canvas ref={ref} style={{ width, height, display: 'block', ...style }}></canvas>;
}

// `level` (0..1) lifts the whole wave: hand speed rises while reaching.
export function ParticleWave({ width, height, markerAt = 0.78, label = 'INTENT · −0.4 s', level = 0, color = '#FF8A1F' }) {
  const lv = useRef(level); const eased = useRef(level); lv.current = level;
  return <RafCanvas width={width} height={height} draw={(ctx, t, w, h) => {
    eased.current += (lv.current - eased.current) * 0.03; const L = eased.current;
    const top = 18, bot = h - 16, H = bot - top;
    const f = x => { const u = x / w; return 0.3 + L * 0.12 * u + (0.2 + L * 0.06) * Math.sin(u * 9 - t * (1.1 + L)) + 0.1 * Math.sin(u * 23 + t * 0.7) + 0.32 * Math.exp(-Math.pow((u - markerAt) / 0.05, 2)); };
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, bot + .5); ctx.lineTo(w, bot + .5); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let x = 0; x < w; x += 2.5) {
      const v = f(x), y = bot - v * H, sp = 3 + v * 12;
      for (let k = 0; k < 6; k++) { const r = rnd(x, k); const off = (r - .5) * 2 * sp * Math.sin(t * .9 + x * .045 + k * 1.3);
        ctx.globalAlpha = .12 + .55 * (1 - Math.abs(r - .5) * 2); ctx.fillRect(x, y + off, 1.3, 1.3); }
      ctx.globalAlpha = .9; ctx.fillRect(x, y, 1.2, 1.2);
    }
    if (markerAt != null) {
      const mx = markerAt * w, my = bot - f(mx) * H;
      ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(mx + .5, top - 6); ctx.lineTo(mx + .5, bot); ctx.stroke(); ctx.setLineDash([]);
      ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = '500 11px "JetBrains Mono"'; ctx.textAlign = 'right'; ctx.fillText(label, mx - 7, top + 2); ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#8b8f94'; ctx.font = '400 11px Poppins'; ctx.fillText('−10 s', 0, h - 2); ctx.fillText('−5 s', w * .45, h - 2); ctx.textAlign = 'right'; ctx.fillText('now', w, h - 2); ctx.textAlign = 'left';
  }} />;
}

export function FlowLines({ width, height, lines = 16 }) {
  return <RafCanvas width={width} height={height} draw={(ctx, t, w, h) => {
    const mid = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.setLineDash([2, 3]);
    for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, h * g / 4); ctx.lineTo(w, h * g / 4); ctx.stroke(); }
    ctx.setLineDash([]);
    for (let i = 0; i < lines; i++) {
      const ph = rnd(i, 1) * 6.28, fr = 1.5 + rnd(i, 2) * 2, off = (rnd(i, 3) - .5);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) { const u = x / w; const env = .15 + .85 * Math.abs(Math.sin(u * 3.1 + .4));
        const y = mid + (off * h * .8 * env) + Math.sin(u * fr * 6.28 + ph + t * .6) * h * .12 * env; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,' + (.12 + rnd(i, 4) * .3).toFixed(2) + ')'; ctx.lineWidth = i === 0 ? 1.3 : 1; ctx.stroke();
    }
  }} />;
}

export function AudioWave({ width, height, active = true, color = '#fff' }) {
  const on = useRef(active); on.current = active; const amp = useRef(active ? 1 : 0);
  return <RafCanvas width={width} height={height} draw={(ctx, t, w, h) => {
    amp.current += ((on.current ? 1 : 0) - amp.current) * 0.08; const A = amp.current;
    const mid = h / 2; ctx.fillStyle = color;
    for (let x = 0; x < w; x += 3) { const u = x / w;
      const live = .25 + .75 * Math.pow(Math.abs(Math.sin(u * 5 + t * 2.2) * Math.sin(u * 2.3 - t * .9)), .7);
      const env = .06 + (live - .06) * A;
      const a = env * (.35 + .65 * rnd(Math.floor(x + t * 30), 7)) * (h / 2 - 1);
      ctx.globalAlpha = .35 + env * .6; ctx.fillRect(x, mid - a, 1.2, a * 2 + 1); }
  }} />;
}

export function CountUp({ value, decimals = 0, duration = 700 }) {
  const [v, setV] = useState(Number(value)); const from = useRef(Number(value));
  useEffect(() => { const start = performance.now(), a = from.current, b = Number(value); let raf;
    const step = now => { const k = Math.min(1, (now - start) / duration), e = 1 - Math.pow(1 - k, 3); setV(a + (b - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = b; };
    raf = requestAnimationFrame(step); return () => { cancelAnimationFrame(raf); from.current = b; }; }, [value]);
  return <>{v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
