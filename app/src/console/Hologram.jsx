import React, { useRef, useEffect, useState } from 'react';
import { TooltipBox } from '../ds';
import { sched, unsched } from './Charts.jsx';

const G = (() => {
  const line = (arr, a, b, step) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / step)); for (let i = 0; i <= n; i++) { const k = i / n; arr.push(a[0] + dx * k, a[1] + dy * k, a[2] + dz * k); } };
  const box = (arr, w, h, d, step, face) => { const V = []; [-w / 2, w / 2].forEach(x => [-h / 2, h / 2].forEach(y => [-d / 2, d / 2].forEach(z => V.push([x, y, z]))));
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const a = V[i], b = V[j]; if ((a[0] !== b[0]) + (a[1] !== b[1]) + (a[2] !== b[2]) === 1) line(arr, a, b, step); }
    if (face) { for (let x = -w / 2 + face; x < w / 2; x += face) for (let y = -h / 2 + face; y < h / 2; y += face) arr.push(x, y, -d / 2, x, y, d / 2);
      for (let z = -d / 2 + face; z < d / 2; z += face) for (let y = -h / 2 + face; y < h / 2; y += face) arr.push(-w / 2, y, z, w / 2, y, z);
      for (let x = -w / 2 + face; x < w / 2; x += face) for (let z = -d / 2 + face; z < d / 2; z += face) arr.push(x, -h / 2, z, x, h / 2, z); } };
  const rack = []; box(rack, 440, 290, 250, 4, 0);
  for (let x = -200; x <= 200; x += 20) for (let y = -125; y <= 125; y += 20) rack.push(x, y, -125);
  for (let x = -200; x <= 200; x += 20) for (let z = -105; z <= 105; z += 20) rack.push(x, -145, z);
  line(rack, [-220, 20, -125], [220, 20, -125], 3); line(rack, [-150, -145, -125], [-150, 145, -125], 5); line(rack, [150, -145, -125], [150, 145, -125], 5);
  const rings = [];
  for (let i = 0; i < 280; i++) { const a = i / 280 * 6.2832; rings.push(Math.cos(a) * 340, -150, Math.sin(a) * 340); }
  for (let i = 0; i < 420; i++) { if (i % 6 < 3) { const a = i / 420 * 6.2832; rings.push(Math.cos(a) * 400, -150, Math.sin(a) * 400); } }
  for (let i = 0; i < 320; i++) { const a = i / 320 * 6.2832; rings.push(Math.cos(a) * 320, Math.sin(a) * 320 * .42, Math.sin(a) * 320 * .9); }
  const container = []; box(container, 120, 64, 86, 3, 10);
  const cube = []; box(cube, 34, 34, 34, 2.5, 6);
  const lid = []; line(lid, [-60, 0, -43], [60, 0, -43], 3); line(lid, [60, 0, -43], [60, 0, 43], 3); line(lid, [60, 0, 43], [-60, 0, 43], 3); line(lid, [-60, 0, 43], [-60, 0, -43], 3);
  for (let x = -48; x <= 48; x += 12) for (let z = -31; z <= 31; z += 12) lid.push(x, 0, z);
  const corners = []; [-220, 220].forEach(x => [-145, 145].forEach(y => [-125, 125].forEach(z => corners.push([x, y, z]))));
  return { rack: new Float32Array(rack), rings: new Float32Array(rings), container: new Float32Array(container), cube: new Float32Array(cube), lid: new Float32Array(lid), corners };
})();

const J = { head: [0, 82, 0], neck: [0, 66, 0], chest: [0, 48, 0], pelvis: [0, 0, 0], shL: [0, 60, -19], shR: [0, 60, 19], elL: [-18, 38, -26], haL: [-34, 22, -18], elR: [-24, 44, 28], haR: [-50, 40, 24], hipL: [0, -4, -10], hipR: [0, -4, 10], knL: [10, -40, -13], knR: [16, -36, 13], ftL: [2, -76, -15], ftR: [20, -70, 14] };
const BONES = [['neck', 'chest'], ['chest', 'pelvis'], ['neck', 'shL'], ['neck', 'shR'], ['shL', 'elL'], ['elL', 'haL'], ['shR', 'elR'], ['elR', 'haR'], ['pelvis', 'hipL'], ['pelvis', 'hipR'], ['hipL', 'knL'], ['knL', 'ftL'], ['hipR', 'knR'], ['knR', 'ftR']];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const AMBER = '#FF8A1F', RED = '#FF3B3B';
const POS = { container: [-100, -113, 10], redIn: [-124, -118, 10], blueIn: [-78, -118, 10], blueOut: [100, -128, 45], lidClosed: [-100, -80, 10], lidOpen: [-100, -40, -64], cTop: [-100, -74, 10] };

export function Hologram({ width, height, verified = 3, intent = 'blue', drift = false, driftSpeed = 3.2, alert = null, objects = {}, onSelect }) {
  const cref = useRef(null);
  const P = useRef({}); P.current = { verified, intent, drift, driftSpeed, alert };
  const S = useRef({ yaw: -.62, pitch: .3, drag: null, anchors: {}, trail: [], t: 0, lastTrail: 0, moved: false });
  const [hover, setHover] = useState(null);
  const hoverKey = useRef(null);

  useEffect(() => {
    const c = cref.current, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr; c.height = height * dpr; const ctx = c.getContext('2d');
    const CX = width / 2, CY = height * .56, SC = Math.min(width / 900, height / 720), FOC = 1100;
    const parts = Array.from({ length: 150 }, () => ({ x: Math.random() * width, y: Math.random() * height, s: .2 + Math.random() * .6, a: Math.random() }));
    let raf, last = performance.now();
    const loop = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; const st = S.current; st.t += dt; const t = st.t; const p = P.current;
      if (!st.drag) st.yaw += dt * .07;
      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const pr = (x, y, z) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const f = FOC / (FOC + z2); return [CX + x1 * SC * f, CY - y1 * SC * f, z2, f]; };
      const alphaZ = z => .16 + .74 * Math.min(1, Math.max(0, (430 - z) / 860));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      for (const q of parts) { q.y -= q.s * dt * 10; if (q.y < 0) q.y = height; ctx.globalAlpha = .06 + .16 * (.5 + .5 * Math.sin(t * 1.4 + q.a * 9)); ctx.fillRect(q.x, q.y, 1, 1); }
      // earth
      const EX = 112, EY = 104, ER = 52, er = t * .12;
      for (let la = -75; la <= 75; la += 15) { const ph = la * Math.PI / 180; for (let lo = 0; lo < 360; lo += 5) { const th = lo * Math.PI / 180 + er;
        const x = Math.cos(ph) * Math.cos(th), y = Math.sin(ph), z = Math.cos(ph) * Math.sin(th); const y1 = y * .94 - z * .34, z1 = y * .34 + z * .94;
        ctx.globalAlpha = z1 < 0 ? .5 : .1; ctx.fillRect(EX + x * ER, EY - y1 * ER, 1.1, 1.1); } }
      for (let lo = 0; lo < 360; lo += 30) { const th = lo * Math.PI / 180 + er; for (let la = -88; la <= 88; la += 4) { const ph = la * Math.PI / 180;
        const x = Math.cos(ph) * Math.cos(th), y = Math.sin(ph), z = Math.cos(ph) * Math.sin(th); const y1 = y * .94 - z * .34, z1 = y * .34 + z * .94;
        ctx.globalAlpha = z1 < 0 ? .4 : .08; ctx.fillRect(EX + x * ER, EY - y1 * ER, 1, 1); } }
      ctx.globalAlpha = .28; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(EX, EY, ER + .5, 0, 7); ctx.stroke();
      ctx.save(); ctx.translate(EX, EY); ctx.rotate(-.35); ctx.globalAlpha = .35; ctx.beginPath(); ctx.ellipse(0, 0, ER * 1.6, ER * .42, 0, 0, 7); ctx.stroke();
      const oa = t * .35, ox = Math.cos(oa) * ER * 1.6, oy = Math.sin(oa) * ER * .42; ctx.restore();
      const stx = EX + ox * Math.cos(-.35) - oy * Math.sin(-.35), sty = EY + ox * Math.sin(-.35) + oy * Math.cos(-.35);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(stx, sty, 2.4, 0, 7); ctx.fill();
      ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(stx, sty, 5 + (t * 6 % 6), 0, 7); ctx.stroke();
      // ground link to nearest rack corner
      let best = null; for (const k of G.corners) { const q = pr(k[0], k[1], k[2]); if (!best || q[0] + q[1] < best[0] + best[1]) best = q; }
      ctx.globalAlpha = .45; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 12; ctx.beginPath(); ctx.moveTo(stx, sty); ctx.lineTo(best[0], best[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = .85; ctx.fillStyle = '#b4b7ba'; ctx.font = '500 11px "JetBrains Mono"';
      ctx.fillText('GROUND LINK • DELAY 5 s', (stx + best[0]) / 2 + 10, (sty + best[1]) / 2 - 6);
      ctx.fillStyle = '#8b8f94'; ctx.font = '400 11px Poppins'; ctx.fillText('EARTH · LEO 408 km', EX - ER, EY + ER + 20);
      // point clouds
      ctx.fillStyle = '#fff';
      const pts = (arr, o, size, rot, am = 1) => { let rcx = 1, rsx = 0, rcz = 1, rsz = 0; if (rot) { rcx = Math.cos(rot[0]); rsx = Math.sin(rot[0]); rcz = Math.cos(rot[1]); rsz = Math.sin(rot[1]); }
        for (let i = 0; i < arr.length; i += 3) { let x = arr[i], y = arr[i + 1], z = arr[i + 2];
          if (rot) { const y1 = y * rcx - z * rsx, z1 = y * rsx + z * rcx; const x2 = x * rcz - y1 * rsz, y2 = x * rsz + y1 * rcz; x = x2; y = y2; z = z1; }
          const q = pr(x + o[0], y + o[1], z + o[2]); ctx.globalAlpha = alphaZ(q[2]) * am; ctx.fillRect(q[0], q[1], size, size); } };
      pts(G.rings, [0, 0, 0], 1.1); ctx.globalCompositeOperation = 'source-over'; pts(G.rack, [0, 0, 0], 1.1, null, .7); pts(G.container, POS.container, 1.4);
      const v = p.verified;
      // astronaut
      const bob = Math.sin(t * .6) * 6, az = .95, ax = .22, ay = -.3, T = [262, 4 + bob, 90];
      const W = {};
      for (const k in J) { let [x, y, z] = J[k]; x *= 1.5; y *= 1.5; z *= 1.5;
        const x1 = x * Math.cos(az) - y * Math.sin(az), y1 = x * Math.sin(az) + y * Math.cos(az), z1 = z;
        const y2 = y1 * Math.cos(ax) - z1 * Math.sin(ax), z2 = y1 * Math.sin(ax) + z1 * Math.cos(ax);
        const x3 = x1 * Math.cos(ay) + z2 * Math.sin(ay), z3 = -x1 * Math.sin(ay) + z2 * Math.cos(ay);
        W[k] = [x3 + T[0], y2 + T[1], z3 + T[2]]; }
      const redIn = !(v >= 2 && v < 4), blueOut = v >= 3 && v < 5;
      const bluePos = blueOut ? POS.blueOut : POS.blueIn;
      const target = p.intent === 'blue' ? bluePos : p.intent === 'container' ? POS.cTop : null;
      if (target) { const d = [target[0] - W.shR[0], target[1] - W.shR[1], target[2] - W.shR[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, reach = 104 * (.94 + .05 * Math.sin(t * 2));
        W.haR = add(W.shR, [d[0] / L * reach, d[1] / L * reach, d[2] / L * reach]); W.elR = add(lerp(W.shR, W.haR, .5), [6, -14, 8]); }
      const redPos = redIn ? POS.redIn : add(W.haL, [-6, -16, 0]);
      pts(G.cube, redPos, 1.5); pts(G.cube, bluePos, 1.5);
      // lid
      let lidPos, lidRot;
      if (v === 0 || v >= 6) { lidPos = POS.lidClosed; lidRot = null; }
      else if (p.drift) { lidPos = [-170 - 26 * Math.sin(t * .25), 30 + 22 * Math.sin(t * .31), -30 + 24 * Math.sin(t * .2)]; lidRot = [.9 + t * .22, .3 + .2 * Math.sin(t * .4)]; }
      else { lidPos = POS.lidOpen; lidRot = [1.35, 0]; }
      if (p.drift && v > 0 && v < 6) { if (t - st.lastTrail > .08) { st.trail.push(lidPos.slice()); st.lastTrail = t; if (st.trail.length > 60) st.trail.shift(); } }
      else if (st.trail.length && t - st.lastTrail > .03) { st.trail.shift(); st.lastTrail = t; }
      pts(G.lid, lidPos, 1.4, lidRot);
      ctx.fillStyle = AMBER; st.trail.forEach((q, i) => { const s = pr(q[0], q[1], q[2]); ctx.globalAlpha = (i / st.trail.length) * .85; ctx.fillRect(s[0] - 1, s[1] - 1, 2, 2); });
      // skeleton
      ctx.fillStyle = '#fff';
      for (const [a, b] of BONES) { const A = W[a], B = W[b], n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) / 3);
        for (let i = 0; i <= n; i++) { const q = pr(...lerp(A, B, i / n)); ctx.globalAlpha = .95; ctx.fillRect(q[0] - .9, q[1] - .9, 1.9, 1.9); } }
      ctx.strokeStyle = '#fff';
      for (const k in W) { if (k === 'head') continue; const q = pr(...W[k]); ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, 7); ctx.stroke(); }
      const hq = pr(...W.head), hr = 18 * SC * hq[3];
      for (let i = 0; i < 28; i++) { const a = i / 28 * 6.2832; ctx.globalAlpha = .9; ctx.fillRect(hq[0] + Math.cos(a) * hr - .8, hq[1] + Math.sin(a) * hr - .8, 1.7, 1.7); }
      ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(hq[0], hq[1], hr + 5, 0, 7); ctx.stroke();
      // anchors + labels
      const anc = { container: pr(...POS.container), red: pr(...redPos), blue: pr(...bluePos), lid: pr(...lidPos), astro: pr(...W.chest) };
      st.anchors = anc;
      const tag = (q, text, color, dx = 22, dy = -26) => { ctx.globalAlpha = .9; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(q[0] + 4, q[1] - 4); ctx.lineTo(q[0] + dx - 6, q[1] + dy); ctx.lineTo(q[0] + dx, q[1] + dy); ctx.stroke();
        ctx.font = '500 11px "JetBrains Mono"'; ctx.fillStyle = color; ctx.fillText(text, q[0] + dx + 4, q[1] + dy + 4); };
      tag(anc.container, 'CONTAINER A-2', '#b4b7ba', -150, 40);
      tag(anc.red, 'RED BOX', '#e6e7e8', -90, -30);
      tag(anc.blue, 'BLUE BOX', '#e6e7e8', 30, 34);
      tag(anc.lid, p.drift && v > 0 && v < 6 ? 'LID • DRIFT ' + p.driftSpeed.toFixed(1) + ' cm/s' : 'LID', p.drift && v > 0 && v < 6 ? AMBER : '#b4b7ba', -40, -40);
      tag(pr(...W.head), 'CREW 01 • TRACKED', '#b4b7ba', 28, -18);
      // intent beam
      if (target) { const col = p.alert === 'critical' ? RED : AMBER; const A = W.haR, B = target, C = add(lerp(A, B, .5), [0, 95, 0]);
        const bz = u => [(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1], (1 - u) * (1 - u) * A[2] + 2 * (1 - u) * u * C[2] + u * u * B[2]];
        const path = []; for (let i = 0; i <= 48; i++) path.push(pr(...bz(i / 48)));
        ctx.strokeStyle = col; ctx.globalAlpha = .22; ctx.lineWidth = 6; ctx.beginPath(); path.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1;
        ctx.fillStyle = col; for (let k = 0; k < 8; k++) { const u = (t * .55 + k / 8) % 1, q = pr(...bz(u)); ctx.globalAlpha = 1 - u * .5; ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); }
        const tq = pr(...B); const g = ctx.createRadialGradient(tq[0], tq[1], 0, tq[0], tq[1], 30); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,138,31,0)');
        ctx.globalAlpha = .55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tq[0], tq[1], 30, 0, 7); ctx.fill(); ctx.fillStyle = col;
        for (let k = 0; k < 48; k++) { const ang = k * 2.399, ph = (t * .7 + k * .071) % 1, r = 6 + ph * 50; ctx.globalAlpha = (1 - ph) * .9; ctx.fillRect(tq[0] + Math.cos(ang) * r, tq[1] + Math.sin(ang) * r * .6, 1.8, 1.8); }
        ctx.strokeStyle = col; const rp = (t * .9) % 1; ctx.globalAlpha = (1 - rp) * .8; ctx.beginPath(); ctx.ellipse(tq[0], tq[1], 16 + rp * 34, (16 + rp * 34) * .45, 0, 0, 7); ctx.stroke();
        const txt = 'INTENT • ' + (p.intent === 'blue' ? 'BLUE BOX • TTC 0.4s' : 'CONTAINER • TTC 0.9s');
        ctx.font = '600 12px "JetBrains Mono"'; const tw = ctx.measureText(txt).width, lx = Math.min(width - tw - 30, tq[0] + 40), ly = tq[1] - 96;
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(tq[0], tq[1] - 10); ctx.lineTo(lx, ly + 12); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(lx, ly - 4, tw + 16, 22); ctx.strokeRect(lx + .5, ly - 3.5, tw + 15, 21);
        ctx.fillStyle = col; ctx.fillText(txt, lx + 8, ly + 11); }
      // scanline
      const sy2 = (t * 55) % height; const sg = ctx.createLinearGradient(0, sy2 - 30, 0, sy2); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,.05)');
      ctx.globalAlpha = 1; ctx.fillStyle = sg; ctx.fillRect(0, sy2 - 30, width, 30); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, sy2, width, 1);
      raf = sched(loop);
    };
    raf = sched(loop);
    return () => unsched(raf);
  }, [width, height]);

  const local = e => { const r = cref.current.getBoundingClientRect(); return [(e.clientX - r.left) * width / r.width, (e.clientY - r.top) * height / r.height]; };
  const onDown = e => { const [x, y] = local(e); S.current.drag = { x, y, yaw: S.current.yaw, pitch: S.current.pitch }; S.current.moved = false; cref.current.setPointerCapture(e.pointerId); };
  const onMove = e => { const [x, y] = local(e); const st = S.current;
    if (st.drag) { st.yaw = st.drag.yaw + (x - st.drag.x) * .006; st.pitch = Math.max(.05, Math.min(.75, st.drag.pitch + (y - st.drag.y) * .004)); if (Math.abs(x - st.drag.x) > 3) st.moved = true; }
    let hit = null, bd = 44; for (const k in st.anchors) { const a = st.anchors[k]; const d = Math.hypot(a[0] - x, a[1] - y); if (d < bd) { bd = d; hit = k; } }
    if (hit !== hoverKey.current) { hoverKey.current = hit; setHover(hit ? { key: hit, x: st.anchors[hit][0], y: st.anchors[hit][1] } : null); } };
  const onUp = e => { const st = S.current; if (st.drag && !st.moved && hoverKey.current && onSelect) onSelect(hoverKey.current); st.drag = null; };
  const onLeave = () => { hoverKey.current = null; setHover(null); };
  const o = hover && objects[hover.key];
  return <div style={{ position: 'relative', width, height }}>
    <canvas ref={cref} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave}
      style={{ width, height, display: 'block', cursor: hover ? 'pointer' : 'grab', filter: 'drop-shadow(0 0 2px rgba(255,255,255,.45))', touchAction: 'none' }}></canvas>
    {o ? <div style={{ position: 'absolute', left: Math.min(width - 200, hover.x + 18), top: Math.max(8, hover.y - 70), pointerEvents: 'none' }}><TooltipBox {...o} /></div> : null}
  </div>;
}
