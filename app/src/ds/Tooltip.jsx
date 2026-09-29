import React from 'react';
export function TooltipBox({ title, rows = [], tone, style }) {
  const c = tone === 'amber' ? 'var(--vs-amber)' : tone === 'green' ? 'var(--vs-green)' : tone === 'red' ? 'var(--vs-red)' : 'var(--border-strong)';
  return <div style={{ minWidth: 150, padding: '8px 10px', background: 'rgba(5,5,5,.92)', border: '1px solid ' + c, backdropFilter: 'blur(4px)', ...style }}>
    {title ? <div style={{ font: '600 12px/1.2 var(--font-mono)', color: tone ? c : 'var(--text-primary)', letterSpacing: '.06em', marginBottom: rows.length ? 6 : 0 }}>{title}</div> : null}
    {rows.map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, font: '500 12px/1.5 var(--font-sans)', color: 'var(--text-muted)' }}><span>{r[0]}</span><span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-numeric)', fontWeight: 600 }}>{r[1]}</span></div>)}
  </div>;
}
export function Tooltip({ content, children, placement = 'top' }) {
  const [o, setO] = React.useState(false);
  const pos = placement === 'bottom' ? { top: '100%', marginTop: 6 } : { bottom: '100%', marginBottom: 6 };
  return <span onMouseEnter={() => setO(true)} onMouseLeave={() => setO(false)} style={{ position: 'relative', display: 'inline-flex' }}>
    {children}
    {o ? <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', ...pos }}>{typeof content === 'string' ? <TooltipBox title={content} /> : content}</span> : null}
  </span>;
}
