import React from 'react';

export const tl = (lang, en, hi) => (lang === 'hi' ? { title: hi, subtitle: en } : { title: en, subtitle: hi });
export const caps = { font: '500 11px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '.14em' };
export const mono = (size = 11, weight = 500) => ({ font: `${weight} ${size}px/1 var(--font-mono)` });

export const TONE = { green: 'var(--vs-green)', amber: 'var(--vs-amber)', red: 'var(--vs-red)', white: '#fff', muted: 'var(--text-muted)', dim: 'var(--text-disabled)' };

export function Chip({ tone = 'muted', children, title, onClick, active, style }) {
  const c = TONE[tone] || tone;
  const Tag = onClick ? 'button' : 'span';
  return <Tag type={onClick ? 'button' : undefined} title={title} onClick={onClick} aria-pressed={onClick ? !!active : undefined}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 8px', border: '1px solid ' + (active ? '#fff' : c), background: active ? '#fff' : 'transparent',
      color: active ? '#000' : c, ...mono(11, 600), letterSpacing: '.08em', whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default', ...style }}>{children}</Tag>;
}

export function Dot({ tone = 'muted', blink }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE[tone] || tone, flex: 'none', animation: blink ? 'vsBlink 1.2s linear infinite' : 'none' }}></span>;
}

export function KV({ k, v, tone, title }) {
  return <div title={title} style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
    <span style={{ ...caps, letterSpacing: '.1em', whiteSpace: 'nowrap' }}>{k}</span>
    <span style={{ marginLeft: 'auto', font: '600 12px/1.2 var(--font-mono)', color: TONE[tone] || tone || '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
  </div>;
}

export const fmtDur = ms => { if (ms == null || ms < 0) return '—'; const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
export const utcClock = d => d.toISOString().slice(11, 19);
export const n = (v, d = 1, unit = '') => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d) + unit);
