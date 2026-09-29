import React from 'react';
export function DotMatrix({ data = [], rowLabels = [], colLabels = [], max, cell = 22, accentAbove, style }) {
  const hi = max != null ? max : Math.max(1, ...data.flat());
  return <div style={{ display: 'grid', gridTemplateColumns: (rowLabels.length ? '36px ' : '') + 'repeat(' + ((data[0] || []).length) + ',' + cell + 'px)', gap: 0, alignItems: 'center', ...style }}>
    {colLabels.length ? <>{rowLabels.length ? <span></span> : null}{colLabels.map((c, i) => <span key={i} style={{ textAlign: 'center', font: '500 11px/1 var(--font-numeric)', color: 'var(--text-muted)', paddingBottom: 6 }}>{c}</span>)}</> : null}
    {data.map((row, ri) => <React.Fragment key={ri}>
      {rowLabels.length ? <span style={{ font: '500 11px/1 var(--font-numeric)', color: 'var(--text-muted)' }}>{rowLabels[ri]}</span> : null}
      {row.map((v, ci) => { const t = v == null ? -1 : v / hi; const hot = accentAbove != null && v != null && v >= accentAbove;
        const d = t < 0 ? 2 : 3 + t * (cell - 10);
        return <span key={ci} style={{ height: cell, display: 'grid', placeItems: 'center' }}>
          <span title={v == null ? '' : String(v)} style={{ width: d, height: d, borderRadius: '50%', background: hot ? 'var(--vs-amber)' : '#fff', opacity: t < 0 ? .15 : .25 + t * .75, boxShadow: t > .7 ? (hot ? 'var(--glow-amber)' : 'var(--glow-white)') : 'none' }}></span></span>; })}
    </React.Fragment>)}
  </div>;
}
