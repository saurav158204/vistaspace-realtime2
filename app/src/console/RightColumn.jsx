import React from 'react';
import { Panel, AlertCard, Button, LineChart, Icon } from '../ds';
import { tl, caps, mono, KV, n } from './ui.jsx';
import { timeOf } from '../live/log.js';
import { SOURCE_TONE } from '../live/backend.js';
import { Sparkline } from '../ds';

function ActiveAlert({ alert, onAck, live }) {
  if (!alert || alert.acked) return <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 64, padding: '0 12px', border: '1px dashed var(--border-default)' }}>
    <Icon name="shield-check" size={16} color={live ? 'var(--vs-green)' : 'var(--text-muted)'} />
    <span style={{ font: '500 13px/1.2 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{alert && alert.acked ? 'Alert acknowledged' : 'No active alert'}</span>
    <span style={{ marginLeft: 'auto', ...mono(11), color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{alert && alert.acked ? 'ACK ' + alert.acked : live ? 'MONITORING' : 'MONITORING OFF'}</span>
  </div>;
  const crit = alert.level === 'critical';
  return <Panel tone={crit ? 'red' : 'amber'} padding="10px 12px" style={{ animation: crit ? 'vsPulse 1.1s ease-in-out infinite' : 'vsSlide .5s var(--ease-out)' }}
    bodyStyle={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, ...mono(11, 600), letterSpacing: '.08em', color: crit ? 'var(--vs-red)' : 'var(--vs-amber)' }}>
        <Icon name={crit ? 'octagon-alert' : 'triangle-alert'} size={13} />{crit ? 'CRITICAL' : 'ATTENTION'} · {alert.kind.toUpperCase()} · {alert.time}</span>
      <span style={{ font: '600 16px/1.2 var(--font-title)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.title}</span>
      <span style={{ font: '400 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.detail}</span>
    </div>
    <Button variant={crit ? 'critical' : 'alert'} icon="check" onClick={onAck}>ACK</Button>
  </Panel>;
}

function MissionLog({ lang, events, alert, onAck, onOpen, live }) {
  return <Panel {...tl(lang, 'Mission Log', 'मिशन लॉग')} marker="06" style={{ height: 330 }} padding="10px 12px"
    right={<button type="button" onClick={() => onOpen({ kind: 'log' })} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', ...mono(11), color: 'var(--text-muted)' }}>{events.length} EVENTS ›</button>}
    bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
    {events.length === 0 ? <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-muted)', padding: '6px 2px' }}>No events yet. Start monitoring; gestures, posture changes, step completions and voice commands are recorded here with timestamps.</div> : null}
    {events.slice(0, 3).map((l, i) => <div key={l.id} style={{ animation: i === 0 ? 'vsSlide .55s var(--ease-out)' : 'none' }}>
      <AlertCard level={l.level} code={l.kind.toUpperCase()} title={l.title} message={l.message} time={timeOf(l.ts)} flash={i === 0 && l.level === 'critical'} onClick={() => onOpen({ kind: 'event', event: l })} />
    </div>)}
    <div style={{ marginTop: 'auto' }}><ActiveAlert alert={alert} onAck={onAck} live={live} /></div>
  </Panel>;
}

function EvidenceRecord({ lang, proc, onOpen }) {
  const done = proc.steps.map(s => [s, proc.records[s.id]]).filter(([, r]) => r && r.status === 'done');
  const last = done[done.length - 1];
  if (!last) return <Panel {...tl(lang, 'Evidence Record', 'साक्ष्य रिकॉर्ड')} marker="07" style={{ height: 150 }} padding="10px 12px" bodyStyle={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14 }}>
    <div style={{ height: 86, border: '1px dashed var(--border-default)', display: 'grid', placeItems: 'center', ...mono(11), color: 'var(--text-muted)' }}>NO EVIDENCE</div>
    <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-muted)' }}>A camera snapshot and the detection context are saved each time a step is completed.</div>
  </Panel>;
  const [s, r] = last;
  return <Panel {...tl(lang, 'Evidence Record', 'साक्ष्य रिकॉर्ड')} marker="07" style={{ height: 150, cursor: 'pointer' }} onClick={() => onOpen({ kind: 'step', id: s.id })}
    padding="10px 12px" bodyStyle={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14 }}>
    {r.evidence && r.evidence.snapshot ? <img src={r.evidence.snapshot} alt={'Evidence ' + s.id} style={{ width: 150, height: 86, objectFit: 'cover', border: '1px solid var(--border-default)', display: 'block' }} />
      : <div style={{ height: 86, border: '1px dashed var(--border-default)', display: 'grid', placeItems: 'center', ...mono(11), color: 'var(--text-muted)', textAlign: 'center' }}>NO CAMERA<br />FRAME</div>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ font: '600 14px/1.2 var(--font-title)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.id} · {lang === 'hi' ? s.titleHi : s.title}</span>
      <span style={{ ...mono(11), color: 'var(--text-muted)' }}>{timeOf(r.at)} · {r.method.toUpperCase()} · CONF {r.confidence != null ? r.confidence.toFixed(2) : 'n/a'}</span>
      <span style={{ ...mono(11), color: 'var(--text-muted)' }}>STEP TIME {(r.elapsedMs / 1000).toFixed(1)} s · POSTURE {(r.details.posture || '—').toUpperCase()}</span>
      <span style={{ ...mono(11), color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>OBJECTS {r.details.objects && r.details.objects.length ? r.details.objects.join(', ').toUpperCase() : '—'}</span>
    </div>
  </Panel>;
}

function DetectionConfidence({ lang, confSeries, live }) {
  const pose = confSeries.map(c => c.pose), hand = confSeries.map(c => c.hand);
  const cur = confSeries.length ? confSeries[confSeries.length - 1] : null;
  return <Panel {...tl(lang, 'Detection Confidence', 'पहचान विश्वास')} marker="08" style={{ height: 130 }} padding="6px 12px"
    right={<span style={{ ...mono(11), color: 'var(--text-muted)' }}>{live && cur ? <>POSE <b style={{ color: '#fff' }}>{n(cur.pose, 0)}</b> · HAND <b style={{ color: 'var(--vs-amber)' }}>{n(cur.hand, 0)}</b> %</> : 'NO INPUT'}</span>}>
    <LineChart width={414} height={80} min={0} max={100} yTicks={2} threshold={{ value: 55, label: 'POSE MIN VISIBILITY' }}
      series={[{ data: pose.length > 1 ? pose.map(v => v ?? 0) : [0, 0], fill: true, color: '#fff' }, { data: hand.length > 1 ? hand.map(v => v ?? 0) : [0, 0], color: '#FF8A1F', width: 1.2 }]} />
  </Panel>;
}

function Telemetry({ lang, be, onFocus, focused }) {
  const label = be.label; const tone = SOURCE_TONE[label] || 'muted';
  const r = be.reading && be.reading.reading;
  const color = tone === 'green' ? 'var(--vs-green)' : tone === 'amber' ? 'var(--vs-amber)' : 'var(--text-muted)';
  const temps = be.series.filter(s => s.ambient != null && be.sensors && s.source === be.sensors.active_source).map(s => s.ambient);
  return <Panel {...tl(lang, 'Sensor Telemetry', 'सेंसर टेलीमेट्री')} marker="09" style={{ height: 130, boxShadow: focused ? 'var(--glow-amber)' : 'none', transition: 'box-shadow .3s' }} padding="8px 12px"
    right={<span title={be.sensors ? JSON.stringify(be.sensors.adapters) : 'backend not connected'} style={{ ...mono(11, 600), color, border: '1px solid ' + color, padding: '2px 6px', letterSpacing: '.08em' }}>{label}</span>}>
    {r ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', columnGap: 14, rowGap: 6, alignItems: 'center' }} onClick={onFocus}>
      <KV k="AMBIENT" v={n(r.ambient_temp_c, 1, ' °C')} />
      <KV k="DEVICE" v={n(r.device_temp_c, 1, ' °C')} tone={r.device_temp_c > 70 ? 'amber' : undefined} />
      <div style={{ gridRow: 'span 3' }}>{temps.length > 1 ? <Sparkline data={temps.slice(-60)} width={120} height={46} color={color} fill /> : null}
        <div style={{ ...mono(11), color: 'var(--text-muted)', marginTop: 4 }}>AMBIENT · {temps.length} PTS</div></div>
      <KV k="HUMIDITY" v={n(r.humidity_pct, 1, ' %')} />
      <KV k="PRESSURE" v={n(r.pressure_hpa, 0, ' hPa')} />
      <KV k="BATTERY" v={r.battery ? n(r.battery.percent, 0, ' %') : '—'} />
      <KV k="POWER" v={n(r.power_w, 2, ' W')} />
      <div style={{ gridColumn: '1 / 3', ...mono(11), color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.device_id} · {be.reading.transport.toUpperCase()} · {timeOf(be.reading.received_at)} UTC</div>
    </div> : <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-muted)' }}>
      {be.conn !== 'connected' ? 'Backend not connected, so there are no sensor readings. Start it with “uvicorn app.main:app” in backend/ (see README).' : 'Backend connected, but no sensor is reporting. Connect a serial/MQTT/HTTP device, or enable VISTA_SIM_FALLBACK for labelled simulated data.'}</div>}
  </Panel>;
}

function SystemHealth({ lang, rows, focused }) {
  return <Panel {...tl(lang, 'System Health', 'सिस्टम स्थिति')} marker="10" style={{ flex: 1, boxShadow: focused ? 'var(--glow-amber)' : 'none', transition: 'box-shadow .3s' }} padding="8px 12px"
    bodyStyle={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 18, rowGap: 7, alignContent: 'start' }}>
    {rows.map(r => <KV key={r[0]} k={r[0]} v={r[1]} tone={r[2]} title={r[3]} />)}
  </Panel>;
}

export function RightColumn(p) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
    <MissionLog {...p} />
    <EvidenceRecord {...p} />
    <DetectionConfidence {...p} />
    <Telemetry {...p} focused={p.focus === 'telemetry'} />
    <SystemHealth lang={p.lang} rows={p.healthRows} focused={p.focus === 'health'} />
  </div>;
}
export { caps };
