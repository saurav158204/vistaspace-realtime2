import React from 'react';
export function Sparkline({ data = [], width = 80, height = 20, color = 'var(--chart-line)', fill = false, strokeWidth = 1, dot = true, min, max, style }) {
  if (!data.length) return <svg width={width} height={height}></svg>;
  const lo = min != null ? min : Math.min(...data), hi = max != null ? max : Math.max(...data), r = hi - lo || 1;
  const pts = data.map((v, i) => [ (i / (data.length - 1 || 1)) * (width - 2) + 1, height - 1 - ((v - lo) / r) * (height - 2) ]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} style={{ display: 'block', overflow: 'visible', ...style }}>
    {fill ? <path d={d + ' L' + last[0] + ' ' + height + ' L1 ' + height + ' Z'} fill={color} opacity=".12"></path> : null}
    <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"></path>
    {dot ? <circle cx={last[0]} cy={last[1]} r="1.8" fill={color}></circle> : null}
  </svg>;
}
