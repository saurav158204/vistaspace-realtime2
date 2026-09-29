import React from 'react';
export function Legend({ items = [], direction = 'row', gap = 20, style }) {
  return <div style={{ display: 'flex', flexDirection: direction, gap, alignItems: direction === 'row' ? 'center' : 'flex-start', flexWrap: 'wrap', ...style }}>
    {items.map((it, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, font: '500 12px/1 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, background: it.color || 'var(--vs-white)', border: it.hollow ? '1px solid ' + (it.color || '#fff') : 0, backgroundClip: 'content-box', flex: 'none', ...(it.hollow ? { background: 'transparent' } : null) }}></span>
      {it.code ? <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{it.code}</span> : null}
      <span>{it.label}</span>
      {it.value != null ? <span style={{ font: '600 14px/1 var(--font-numeric)', color: 'var(--text-primary)' }}>{it.value}</span> : null}
    </div>)}
  </div>;
}
