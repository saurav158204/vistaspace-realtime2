import React from 'react';
import { SegmentedControl, Icon } from '../ds';

function Emblem() {
  const tick = s => <span style={{ position: 'absolute', background: '#fff', ...s }}></span>;
  return <span title="Placeholder emblem" style={{ position: 'relative', width: 36, height: 36, flex: 'none', display: 'block' }}>
    <span style={{ position: 'absolute', inset: 4, border: '1px solid #fff', borderRadius: '50%' }}></span>
    <span style={{ position: 'absolute', inset: 12, border: '1px dashed rgba(255,255,255,.55)', borderRadius: '50%' }}></span>
    <span style={{ position: 'absolute', left: 16, top: 16, width: 4, height: 4, background: 'var(--vs-amber)', boxShadow: 'var(--glow-amber)' }}></span>
    {tick({ left: 17.5, top: 0, width: 1, height: 7 })}{tick({ left: 17.5, bottom: 0, width: 1, height: 7 })}{tick({ top: 17.5, left: 0, height: 1, width: 7 })}{tick({ top: 17.5, right: 0, height: 1, width: 7 })}
  </span>;
}

function Metric({ label, value, unit, tone }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '.18em', whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{ font: '600 17px/1 var(--font-numeric)', color: tone || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}{unit ? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span> : null}</span>
  </div>;
}

export function TopBar({ lang, setLang, net, fps, inference, vision, clock, ticker }) {
  const items = ticker.concat(ticker);
  const netTone = net.tone === 'green' ? 'var(--vs-green)' : net.tone === 'amber' ? 'var(--vs-amber)' : '#fff';
  return <header style={{ display: 'grid', gridTemplateColumns: '560px minmax(0,1fr) auto', alignItems: 'center', gap: 28, height: 60, borderBottom: '1px solid var(--border-divider)', position: 'relative' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Emblem />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap' }}>
          <span style={{ font: '800 25px/1 var(--font-title)', letterSpacing: '-.03em', color: '#fff' }}>VISTASpace</span>
          <span style={{ font: '300 19px/1 var(--font-title)', color: 'var(--text-secondary)' }}>— Experiment Intelligence Console</span>
        </div>
        <span style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '.24em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Visual Intelligent Sequence Tracking &amp; Alert Assistant</span>
      </div>
    </div>
    <div style={{ position: 'relative', height: 30, overflow: 'hidden', borderLeft: '1px solid var(--border-default)', borderRight: '1px solid var(--border-default)', maskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 30, display: 'flex', alignItems: 'center', gap: 26, whiteSpace: 'nowrap', animation: 'vsTicker ' + Math.max(24, ticker.length * 7) + 's linear infinite' }}>
        {items.map((c, i) => <span key={i} style={{ font: '500 12px/1 var(--font-mono)', color: c.tone === 'red' ? 'var(--vs-red)' : c.tone === 'amber' ? 'var(--vs-amber)' : c.tone === 'green' ? 'var(--vs-green)' : 'var(--text-secondary)' }}>{'<' + c.t + '>'}</span>)}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <span title={net.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 10px', border: '1px solid ' + (net.tone === 'amber' ? 'var(--vs-amber)' : 'var(--border-strong)'), font: '600 11px/1 var(--font-mono)', letterSpacing: '.1em', color: netTone, whiteSpace: 'nowrap' }}>
        <Icon name={net.online ? 'wifi' : 'wifi-off'} size={13} />{net.label}</span>
      <Metric label="CAM FPS" value={fps == null ? '—' : String(Math.round(fps))} />
      <Metric label="INFERENCE" value={inference == null ? '—' : String(Math.round(inference))} unit={inference == null ? '' : 'ms'} />
      <Metric label="VISION" value={vision.label} tone={vision.tone} />
      <Metric label="MISSION TIME · UTC" value={clock} />
      <SegmentedControl size="sm" value={lang} onChange={setLang} options={[{ value: 'en', label: 'EN' }, { value: 'hi', label: 'हिं' }]} />
    </div>
  </header>;
}
