import React from 'react';
export function Drawer({ open, title, subtitle, onClose, children, footer, width = 520 }) {
  return <div aria-hidden={!open} style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: open ? 'auto' : 'none' }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--surface-scrim)', opacity: open ? 1 : 0, transition: 'opacity var(--dur-base) linear' }}></div>
    <aside role="dialog" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width, display: 'flex', flexDirection: 'column', background: 'var(--vs-ink-950)',
      borderLeft: '1px solid var(--border-strong)', transform: open ? 'none' : 'translateX(100%)', transition: 'transform var(--dur-slow) var(--ease-out)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 24px 16px', borderBottom: '1px solid var(--border-divider)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ font: '700 22px/1.1 var(--font-title)', color: 'var(--text-primary)' }}>{title}</div>
          {subtitle ? <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', font: '400 16px/1 var(--font-mono)', cursor: 'pointer' }}>×</button>
      </header>
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>{children}</div>
      {footer ? <footer style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 24px', borderTop: '1px solid var(--border-divider)' }}>{footer}</footer> : null}
    </aside>
  </div>;
}
