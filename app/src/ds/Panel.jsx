import React from 'react';
function Corner({ pos, color }) {
  const b = '1px solid ' + color; const s = { position: 'absolute', width: 8, height: 8, pointerEvents: 'none' };
  if (pos[0] === 't') { s.top = -1; s.borderTop = b; } else { s.bottom = -1; s.borderBottom = b; }
  if (pos[1] === 'l') { s.left = -1; s.borderLeft = b; } else { s.right = -1; s.borderRight = b; }
  return <span style={s}></span>;
}
export function Panel({ title, subtitle, marker, right, children, padding = 12, corners = true, tone, onClick, style, bodyStyle }) {
  const col = tone === 'amber' ? 'var(--vs-amber)' : tone === 'red' ? 'var(--vs-red)' : 'var(--bracket)';
  return <section onClick={onClick} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid ' + (tone ? col : 'var(--border-panel)'),
    background: tone === 'amber' ? 'var(--vs-amber-dim)' : tone === 'red' ? 'var(--vs-red-dim)' : 'var(--surface-panel)', ...style }}>
    {corners ? ['tl', 'tr', 'bl', 'br'].map(p => <Corner key={p} pos={p} color={col} />) : null}
    {title ? <header style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px 7px', borderBottom: '1px solid var(--border-divider)', background: 'var(--surface-panel-header)' }}>
      <span style={{ width: 5, height: 5, background: tone ? col : 'var(--vs-white)', alignSelf: 'center', flex: 'none' }}></span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
        <div style={{ font: '600 15px/1.25 var(--font-title)', color: 'var(--text-primary)', letterSpacing: '-.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {subtitle ? <div style={{ font: 'var(--text-panel-subtitle)', color: 'var(--text-muted)', letterSpacing: '.04em' }}>{subtitle}</div> : null}
      </div>
      {right ? <span style={{ flex: 'none', whiteSpace: 'nowrap', alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }}>{right}</span> : null}
      {marker ? <span style={{ font: '600 11px/1 var(--font-mono)', background: 'var(--vs-white)', color: 'var(--vs-black)', padding: '2px 4px', alignSelf: 'center' }}>{marker}</span> : null}
    </header> : null}
    <div style={{ padding, flex: 1, minHeight: 0, position: 'relative', ...bodyStyle }}>{children}</div>
  </section>;
}
