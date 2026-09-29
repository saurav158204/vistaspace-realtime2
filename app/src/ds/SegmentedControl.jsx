import React from 'react';
export function SegmentedControl({ options = [], value, onChange, size = 'md', style }) {
  const sm = size === 'sm';
  return <div role="tablist" style={{ display: 'inline-flex', border: '1px solid var(--border-default)', ...style }}>
    {options.map((o, i) => { const on = o.value === value;
      return <button key={o.value} role="tab" aria-selected={on} type="button" onClick={() => onChange && onChange(o.value)}
        style={{ height: sm ? 22 : 28, padding: sm ? '0 8px' : '0 12px', border: 0, borderLeft: i ? '1px solid var(--border-default)' : 0, borderRadius: 0,
          background: on ? 'var(--surface-inverse)' : 'transparent', color: on ? 'var(--text-inverse)' : 'var(--text-secondary)',
          font: '600 ' + (sm ? 11 : 12) + 'px/1 var(--font-sans)', letterSpacing: '.04em', cursor: 'pointer' }}>{o.label}</button>; })}
  </div>;
}
