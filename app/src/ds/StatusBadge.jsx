import React from 'react';
import { Icon } from './Icon.jsx';
const S = {
  verified: { c: 'var(--status-verified)', i: 'circle-check', l: 'Verified' },
  progress: { c: 'var(--text-primary)', i: 'loader-circle', l: 'In progress' },
  next: { c: 'var(--text-secondary)', i: 'circle-arrow-right', l: 'Next' },
  queued: { c: 'var(--text-muted)', i: 'circle-dashed', l: 'Queued' },
  warning: { c: 'var(--status-warning)', i: 'triangle-alert', l: 'Warning' },
  drift: { c: 'var(--status-warning)', i: 'move-up-right', l: 'Drifting' },
  critical: { c: 'var(--status-critical)', i: 'octagon-alert', l: 'Critical' },
  info: { c: 'var(--text-muted)', i: 'info', l: 'Info' },
};
export function StatusBadge({ status = 'info', label, outline = false, style }) {
  const s = S[status] || S.info;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: s.c, font: '500 11px/1 var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    padding: outline ? '3px 6px' : 0, border: outline ? '1px solid currentColor' : 'none', ...style }}>
    <Icon name={s.i} size={12} />{label || s.l}
  </span>;
}
