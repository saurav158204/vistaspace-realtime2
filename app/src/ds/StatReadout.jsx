import React from 'react';
const T = { default: 'var(--text-primary)', amber: 'var(--vs-amber)', green: 'var(--vs-green)', red: 'var(--vs-red)' };
export function StatReadout({ label, sublabel, value, unit, tone = 'default', size = 'md', style }) {
  const fs = size === 'lg' ? 42 : size === 'sm' ? 22 : 30;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid ' + (tone === 'default' ? 'var(--vs-grey-500)' : T[tone]) }}></span>
      <span style={{ font: '500 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
    {sublabel ? <div style={{ font: '400 11px/1.2 var(--font-sans)', color: 'var(--text-muted)', marginTop: -2 }}>{sublabel}</div> : null}
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, color: T[tone] || T.default }}>
      <span style={{ font: '600 ' + fs + 'px/1 var(--font-numeric)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {unit ? <span style={{ whiteSpace: 'nowrap', font: '400 ' + Math.max(12, Math.round(fs * .42)) + 'px/1 var(--font-numeric)', color: 'var(--text-muted)' }}>{unit}</span> : null}
    </div>
  </div>;
}
