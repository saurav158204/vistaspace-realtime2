import React from 'react';
import { Panel, StatReadout, DataTable, StatusBadge, Icon, LineChart } from '../ds';
import { RafCanvas, CountUp } from './Charts.jsx';
import { tl, mono, fmtDur } from './ui.jsx';
import { GESTURES } from '../live/gestures.js';
import { LEVEL_TONE } from './Monitor.jsx';

const METHOD = { manual: 'MAN', voice: 'VOX', gesture: 'GES', auto: 'AUTO', override: 'SKIP' };

function StationGlyph({ live }) {
  return <div style={{ position: 'relative', width: 118, height: 146, border: '1px solid var(--border-panel)', display: 'grid', placeItems: 'center', background: 'var(--bg-dots)' }}>
    <span style={{ position: 'absolute', width: 92, height: 92, border: '1px dashed rgba(255,255,255,.3)', borderRadius: '50%', animation: live ? 'vsBlink 2.4s linear infinite' : 'none' }}></span>
    <span style={{ position: 'absolute', width: 64, height: 64, border: '1px solid rgba(255,255,255,.14)', borderRadius: '50%' }}></span>
    <Icon name="satellite" size={46} color="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,.5))' }} />
    <span style={{ position: 'absolute', bottom: 7, left: 0, right: 0, textAlign: 'center', ...mono(11), color: live ? 'var(--vs-green)' : 'var(--text-muted)' }}>{live ? 'MONITORING' : 'STANDBY'}</span>
  </div>;
}

function MissionStatus({ lang, proc, alerts, posture, poseOn, elapsed, live }) {
  const verified = Object.values(proc.records).filter(r => r.status === 'done').length;
  const pTone = !poseOn ? 'default' : posture === 'critical' ? 'red' : posture === 'attention' ? 'amber' : posture === 'nominal' ? 'green' : 'default';
  const pText = !poseOn ? '—' : { nominal: 'OK', attention: 'ATTN', critical: 'CRIT', unknown: '—' }[posture];
  return <Panel {...tl(lang, 'Mission Status', 'मिशन स्थिति')} marker="01" style={{ height: 196 }} bodyStyle={{ display: 'grid', gridTemplateColumns: '118px 1fr', gap: 16, alignItems: 'center' }}>
    <StationGlyph live={live} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 12 }}>
      <StatReadout label="Steps Verified" sublabel="सत्यापित चरण" value={<><CountUp value={verified} />/{proc.steps.length}</>} tone={proc.done ? 'green' : 'default'} />
      <StatReadout label="Alerts" sublabel="चेतावनियाँ" value={<CountUp value={alerts} />} tone={alerts ? 'amber' : 'default'} />
      <StatReadout label="Posture" sublabel="मुद्रा" value={pText} tone={pTone} />
      <StatReadout label="Monitoring" sublabel="निगरानी समय" value={fmtDur(elapsed)} unit={elapsed != null ? 'min' : ''} />
    </div>
  </Panel>;
}

function ProcedureTimeline({ lang, proc, onOpen }) {
  const rows = proc.steps.map((s, i) => { const r = proc.records[s.id];
    const status = r ? (r.status === 'done' ? 'verified' : 'skipped') : i === proc.index ? 'progress' : i === proc.index + 1 ? 'next' : 'queued';
    return { ...s, i, r, status }; });
  const LABEL = { verified: 'Verified', skipped: 'Skipped', progress: 'Active', next: 'Next', queued: 'Queued' };
  return <Panel {...tl(lang, 'Procedure Timeline', 'प्रक्रिया')} marker="02" style={{ height: 226 }} padding={0}
    right={<span style={{ ...mono(11), color: 'var(--text-muted)' }}>{proc.def.id.toUpperCase().slice(0, 22)}</span>}>
    <DataTable dense activeIndex={proc.done ? undefined : proc.index} onRowClick={r => r.r && onOpen({ kind: 'step', id: r.id })} rows={rows} columns={[
      { key: 'id', label: 'Step', mono: true, width: 34 },
      { key: 'title', label: 'Action', render: r => (lang === 'hi' ? r.titleHi : r.title) },
      { key: 'status', label: 'Status', width: 98, render: r => <StatusBadge status={r.status === 'skipped' ? 'warning' : r.status} label={LABEL[r.status]} /> },
      { key: 'time', label: 'Time', mono: true, width: 72, render: r => (r.r ? new Date(r.r.at).toISOString().slice(11, 19) : r.status === 'progress' ? 'live' : '—') },
      { key: 'm', label: 'By', mono: true, width: 42, render: r => (r.r ? METHOD[r.r.method] : '—') },
      { key: 'conf', label: 'Conf', mono: true, width: 40, align: 'right', render: r => (r.r && r.r.confidence != null ? r.r.confidence.toFixed(2) : '—') },
    ]} />
  </Panel>;
}

function MotionSignal({ lang, motionSeries, motion, speed }) {
  const peak = Math.max(5, ...motionSeries);
  return <Panel {...tl(lang, 'Motion Signal', 'गति संकेत')} marker="03" style={{ height: 150 }} padding="6px 12px"
    right={<span style={{ ...mono(11), color: 'var(--text-muted)' }}>{motion.ready ? 'OPENCV.JS · FRAME DIFF %' : motion.state}</span>}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: 10, alignItems: 'center' }}>
      <LineChart width={318} height={90} min={0} max={Math.ceil(peak / 5) * 5} yTicks={2} series={[{ data: motionSeries.length > 1 ? motionSeries : [0, 0], fill: true, color: '#fff' }]} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div><div style={{ ...mono(11), color: 'var(--text-muted)' }}>MOTION</div><div style={{ font: '600 18px/1.2 var(--font-numeric)' }}>{motion.ready ? (motion.energy * 100).toFixed(1) : '—'}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}> %</span></div></div>
        <div title="Palm speed in frame-widths per second"><div style={{ ...mono(11), color: 'var(--text-muted)' }}>HAND SPEED</div><div style={{ font: '600 18px/1.2 var(--font-numeric)' }}>{speed == null ? '—' : speed.toFixed(2)}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}> fw/s</span></div></div>
      </div>
    </div>
  </Panel>;
}

function HandsPanel({ lang, hands, lastBySide, gestureCount, handsOn }) {
  const rows = ['Left', 'Right'].map(side => { const h = hands.find(x => x.side === side); return { side, h, last: lastBySide[side] }; });
  return <Panel {...tl(lang, 'Hands & Gestures', 'हाथ और इशारे')} marker="04" style={{ height: 158 }} padding={0}
    right={<span style={{ ...mono(11), color: 'var(--text-secondary)' }}>{handsOn ? 'EVENTS ' + gestureCount : 'TRACKING OFF'}</span>}>
    <DataTable dense rows={rows} columns={[
      { key: 'side', label: 'Hand', width: 52, render: r => r.side },
      { key: 'g', label: 'Gesture', render: r => (r.h ? (r.h.gesture ? <span style={{ color: 'var(--vs-amber)' }}>{GESTURES[r.h.gesture].label}</span> : 'Tracked') : <span style={{ color: 'var(--text-muted)' }}>Not in view</span>) },
      { key: 'c', label: 'Conf', mono: true, width: 42, render: r => (r.h ? (r.h.gesture ? r.h.score : r.h.handScore).toFixed(2) : '—') },
      { key: 'p', label: 'X,Y', mono: true, width: 76, render: r => (r.h ? r.h.x.toFixed(2) + ',' + r.h.y.toFixed(2) : '—') },
      { key: 'l', label: 'Last event', mono: true, width: 110, render: r => (r.last ? GESTURES[r.last.gesture].label.split(' ')[0].toUpperCase().slice(0, 6) + ' ' + new Date(r.last.at).toISOString().slice(11, 19) : '—') },
    ]} />
    <div style={{ padding: '6px 8px', ...mono(11), color: 'var(--text-muted)' }}>X,Y = palm centre in the displayed (mirrored) frame, 0–1</div>
  </Panel>;
}

function HandTrajectory({ lang, trailRef, handsOn }) {
  return <Panel {...tl(lang, 'Hand Trajectory', 'हाथ का पथ')} marker="05" style={{ flex: 1 }} padding="8px 12px"
    right={<span style={{ ...mono(11), color: 'var(--text-muted)' }}>{handsOn ? 'PALM X/Y · LAST 3 S' : 'NO INPUT'}</span>}>
    <RafCanvas width={414} height={88} draw={(ctx, t, w, h) => {
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.setLineDash([2, 3]);
      for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, h * g / 4); ctx.lineTo(w, h * g / 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w * g / 4, 0); ctx.lineTo(w * g / 4, h); ctx.stroke(); }
      ctx.setLineDash([]);
      const now = performance.now(); const trail = trailRef.current;
      for (const side of ['Left', 'Right']) {
        const pts = trail[side].filter(p => now - p.t < 3000);
        trail[side] = pts;
        if (pts.length < 2) continue;
        ctx.strokeStyle = side === 'Right' ? '#FF8A1F' : '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); pts.forEach((p, i) => { const x = p.x * w, y = p.y * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        const last = pts[pts.length - 1]; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(last.x * w, last.y * h, 3, 0, 7); ctx.fill();
        ctx.font = '500 11px "JetBrains Mono"'; ctx.fillText(side[0], last.x * w + 6, last.y * h - 4);
      }
      if (!trail.Left.length && !trail.Right.length) { ctx.fillStyle = '#5a5e63'; ctx.font = '500 11px "JetBrains Mono"'; ctx.fillText('NO HANDS IN VIEW', 8, h / 2 + 4); }
    }} />
  </Panel>;
}

export function LeftColumn(p) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
    <MissionStatus {...p} />
    <ProcedureTimeline {...p} />
    <MotionSignal {...p} />
    <HandsPanel {...p} />
    <HandTrajectory {...p} />
  </div>;
}
export { LEVEL_TONE };
