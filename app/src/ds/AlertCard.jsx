import React from 'react';
import { Icon } from './Icon.jsx';
const L = {
  warning: { c: 'var(--vs-amber)', bg: 'var(--vs-amber-dim)', i: 'triangle-alert', t: 'Warning' },
  drift: { c: 'var(--vs-amber)', bg: 'var(--vs-amber-dim)', i: 'move-up-right', t: 'Drift' },
  critical: { c: 'var(--vs-red)', bg: 'var(--vs-red-dim)', i: 'octagon-alert', t: 'Critical' },
  verified: { c: 'var(--vs-green)', bg: 'var(--vs-green-dim)', i: 'circle-check', t: 'Verified' },
  info: { c: 'var(--vs-grey-300)', bg: 'transparent', i: 'info', t: 'Info' },
};
export function AlertCard({ level = 'info', code, title, message, time, onClick, flash = false, style }) {
  const l = L[level] || L.info; const [h, setH] = React.useState(false);
  return <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto', gap: 10, alignItems: 'start', padding: '9px 10px', cursor: onClick ? 'pointer' : 'default',
      borderStyle: 'solid', borderWidth: 1, borderTopColor: flash ? l.c : 'var(--border-panel)', borderRightColor: flash ? l.c : 'var(--border-panel)', borderBottomColor: flash ? l.c : 'var(--border-panel)', borderLeftColor: l.c, background: h ? 'var(--surface-hover)' : flash ? l.bg : 'transparent',
      boxShadow: flash ? (level === 'critical' ? 'var(--glow-red)' : 'var(--glow-amber)') : 'none', transition: 'background var(--dur-fast) linear, box-shadow var(--dur-base) linear', ...style }}>
    <span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid ' + l.c, color: l.c }}><Icon name={l.i} size={15} /></span>
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span style={{ font: '600 12px/1 var(--font-mono)', color: l.c, letterSpacing: '.06em' }}>{title || l.t}</span>
        {code ? <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{code}</span> : null}
      </div>
      {message ? <div style={{ font: '500 13px/1.3 var(--font-sans)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{message}</div> : null}
    </div>
    {time ? <span style={{ font: '500 12px/1 var(--font-numeric)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{time}</span> : null}
  </div>;
}
