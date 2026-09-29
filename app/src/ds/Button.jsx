import React from 'react';
import { Icon } from './Icon.jsx';
const V = {
  primary: { bg: 'var(--surface-inverse)', fg: 'var(--text-inverse)', bd: 'var(--surface-inverse)', hbg: 'var(--vs-grey-100)' },
  secondary: { bg: 'transparent', fg: 'var(--text-primary)', bd: 'var(--border-strong)', hbg: 'var(--surface-hover)' },
  ghost: { bg: 'transparent', fg: 'var(--text-secondary)', bd: 'transparent', hbg: 'var(--surface-hover)' },
  alert: { bg: 'var(--vs-amber)', fg: 'var(--vs-black)', bd: 'var(--vs-amber)', hbg: 'var(--vs-amber-soft)' },
  critical: { bg: 'var(--vs-red)', fg: 'var(--vs-black)', bd: 'var(--vs-red)', hbg: '#ff6a6a' },
};
export function Button({ variant = 'secondary', size = 'md', icon, children, onClick, disabled, title, style }) {
  const [h, setH] = React.useState(false); const [p, setP] = React.useState(false);
  const v = V[variant] || V.secondary; const sm = size === 'sm';
  return <button type="button" disabled={disabled} onClick={onClick} title={title} aria-label={children ? undefined : title}
    onMouseEnter={() => setH(true)} onMouseLeave={() => { setH(false); setP(false); }} onMouseDown={() => setP(true)} onMouseUp={() => setP(false)}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: sm ? 24 : 30, padding: sm ? '0 8px' : '0 12px', borderRadius: 0,
      border: '1px solid ' + v.bd, background: h && !disabled ? v.hbg : v.bg, color: v.fg, opacity: disabled ? .35 : 1,
      font: '600 ' + (sm ? 11 : 12) + 'px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', flex: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      transform: p ? 'translateY(1px)' : 'none', transition: 'background var(--dur-fast) linear', ...style }}>
    {icon ? <Icon name={icon} size={sm ? 12 : 13} /> : null}{children}
  </button>;
}
