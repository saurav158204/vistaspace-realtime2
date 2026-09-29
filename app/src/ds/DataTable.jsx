import React from 'react';
export function DataTable({ columns = [], rows = [], onRowClick, activeIndex, dense = false, style }) {
  const py = dense ? 5 : 7, px = dense ? 6 : 8;
  return <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', ...style }}>
    <thead><tr style={{ background: 'var(--surface-panel-header)' }}>
      {columns.map(c => <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left', padding: '5px ' + px + 'px', font: '500 11px/1.2 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' }}>{c.label}</th>)}
    </tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} onClick={onRowClick ? () => onRowClick(r, i) : undefined}
      style={{ cursor: onRowClick ? 'pointer' : 'default', background: i === activeIndex ? 'var(--surface-hover)' : 'transparent', boxShadow: i === activeIndex ? 'inset 2px 0 0 var(--vs-white)' : 'none' }}>
      {columns.map(c => <td key={c.key} style={{ textAlign: c.align || 'left', padding: py + 'px ' + px + 'px', font: (c.mono ? '500 12px/1.2 var(--font-mono)' : '400 12px/1.2 var(--font-sans)'), color: 'var(--text-primary)', borderBottom: '1px solid var(--border-divider)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.render ? c.render(r, i) : r[c.key]}</td>)}
    </tr>)}</tbody>
  </table>;
}
