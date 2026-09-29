import React from 'react';
export function LineChart({ series = [], width = 400, height = 140, min, max, threshold, xLabels = [], yTicks = 3, yFormat, style }) {
  const pad = { l: 34, r: 8, t: 8, b: xLabels.length ? 18 : 6 };
  const all = series.flatMap(s => s.data);
  const lo = min != null ? min : Math.min(...all), hi = max != null ? max : Math.max(...all), r = hi - lo || 1;
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const x = (i, n) => pad.l + (i / (n - 1 || 1)) * W, y = v => pad.t + H - ((v - lo) / r) * H;
  const uid = React.useMemo(() => 'lc' + Math.random().toString(36).slice(2, 8), []);
  const fmt = yFormat || (v => Math.round(v));
  return <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} style={{ display: 'block', ...style }}>
    <defs>{series.map((s, k) => <linearGradient key={k} id={uid + k} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color || '#fff'} stopOpacity=".28"></stop><stop offset="1" stopColor={s.color || '#fff'} stopOpacity="0"></stop></linearGradient>)}</defs>
    {Array.from({ length: yTicks + 1 }).map((_, i) => { const v = lo + (r * i) / yTicks; return <g key={i}>
      <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeDasharray="2 3"></line>
      <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" fill="var(--text-muted)" style={{ font: '500 11px var(--font-numeric)' }}>{fmt(v)}</text></g>; })}
    <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + H} stroke="var(--chart-axis)"></line>
    {series.map((s, k) => { const n = s.data.length; const d = s.data.map((v, i) => (i ? 'L' : 'M') + x(i, n).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
      return <g key={k}>{s.fill ? <path d={d + ' L' + x(n - 1, n) + ' ' + (pad.t + H) + ' L' + pad.l + ' ' + (pad.t + H) + ' Z'} fill={'url(#' + uid + k + ')'}></path> : null}
        <path d={d} fill="none" stroke={s.color || 'var(--chart-line)'} strokeWidth={s.width || 1} strokeDasharray={s.dashed ? '3 3' : undefined} strokeLinejoin="round"></path>
        <circle cx={x(n - 1, n)} cy={y(s.data[n - 1])} r="2.2" fill={s.color || 'var(--chart-line)'}></circle></g>; })}
    {threshold ? <g><line x1={pad.l} x2={width - pad.r} y1={y(threshold.value)} y2={y(threshold.value)} stroke={threshold.color || 'var(--vs-amber)'} strokeDasharray="4 3"></line>
      {threshold.label ? <text x={width - pad.r} y={y(threshold.value) - 4} textAnchor="end" fill={threshold.color || 'var(--vs-amber)'} style={{ font: '500 11px var(--font-mono)' }}>{threshold.label}</text> : null}</g> : null}
    {xLabels.map((l, i) => <text key={i} x={x(i, xLabels.length)} y={height - 4} textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'} fill="var(--text-muted)" style={{ font: '500 11px var(--font-numeric)' }}>{l}</text>)}
  </svg>;
}
