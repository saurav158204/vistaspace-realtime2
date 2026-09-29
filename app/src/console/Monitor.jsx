import React from 'react';
import { Panel, Icon, Button } from '../ds';
import { Hologram } from './Hologram.jsx';
import { Chip, Dot, caps, mono } from './ui.jsx';
import { POSTURE_THRESHOLDS } from '../live/posture.js';
import { GESTURES } from '../live/gestures.js';

const VW = 958, VH = 539; // video area (16:9) inside the 958-wide monitor
const LEVEL_TONE = { nominal: 'var(--vs-green)', attention: 'var(--vs-amber)', critical: 'var(--vs-red)', unknown: 'var(--text-muted)' };
const LEVEL_TEXT = { nominal: 'NOMINAL', attention: 'ATTENTION REQUIRED', critical: 'CRITICAL', unknown: 'NOT ASSESSED' };
export { LEVEL_TONE, LEVEL_TEXT };

function Overlay({ children, tone }) {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.62)', zIndex: 3 }}>
    <div style={{ width: 520, padding: '22px 24px', border: '1px solid ' + (tone || 'var(--border-strong)'), background: 'rgba(5,5,5,.92)', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </div>;
}

function IdleCard({ cam, onStart, vision }) {
  const err = ['denied', 'no-camera', 'in-use', 'disconnected', 'unsupported', 'insecure', 'error'].includes(cam.state);
  const busy = cam.state === 'requesting';
  const title = err ? { denied: 'Camera permission denied', 'no-camera': 'No camera found', 'in-use': 'Camera unavailable', disconnected: 'Camera disconnected',
    unsupported: 'Camera not supported', insecure: 'Secure page required', error: 'Camera error' }[cam.state] : busy ? 'Requesting camera…' : 'Monitoring is off';
  const canRetry = !['unsupported', 'insecure'].includes(cam.state);
  return <Overlay tone={err ? 'var(--vs-red)' : undefined}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...mono(11, 600), letterSpacing: '.12em', color: err ? 'var(--vs-red)' : 'var(--text-muted)' }}>
      <Icon name={err ? 'camera-off' : 'camera'} size={14} />{err ? 'CAMERA · ' + cam.state.toUpperCase() : 'CAMERA · OFF'}</span>
    <div style={{ font: '700 24px/1.2 var(--font-title)', color: '#fff' }}>{title}</div>
    <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>
      {err ? cam.text + (cam.error ? ' (' + cam.error + ')' : '') : 'The camera turns on only when you press Start. Frames are analysed on this device with MediaPipe and OpenCV.js; nothing is recorded unless you capture evidence.'}</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {canRetry ? <Button variant="primary" icon="play" onClick={onStart} disabled={busy}>{err ? 'Try again' : 'Start monitoring'}</Button> : null}
      <span style={{ ...mono(11), color: 'var(--text-muted)' }}>{vision}</span>
    </div>
  </Overlay>;
}

function PostureStrip({ snap, pose, onCalibrate, calibrated, lang }) {
  const P = snap.posture; const d = P.dev || {}; const m = snap.pose && snap.pose.metrics;
  const T = POSTURE_THRESHOLDS;
  const rows = [['headTilt', 'Head tilt', 'सिर झुकाव'], ['neck', 'Neck alignment', 'गर्दन'], ['shoulderLevel', 'Shoulder level', 'कंधे'], ['torsoLean', 'Torso lean', 'धड़ झुकाव'], ['arm', 'Arm elevation', 'बाँह']];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="person" size={14} color="#fff" /><span style={{ ...caps, color: '#fff' }}>{lang === 'hi' ? 'मुद्रा' : 'POSTURE'}</span>
      <span style={{ marginLeft: 'auto', ...mono(11, 600), letterSpacing: '.08em', color: pose ? LEVEL_TONE[P.level] : 'var(--text-muted)' }}>{pose ? LEVEL_TEXT[P.level] : 'POSE OFF'}</span>
    </div>
    {rows.map(([k, en, hi]) => {
      const v = d[k]; const t = T[k]; const lvl = v == null ? null : t.critical != null && v >= t.critical ? 'critical' : v >= t.attention ? 'attention' : 'nominal';
      const max = k === 'arm' ? 180 : (t.critical || t.attention) * 1.4;
      return <div key={k} style={{ display: 'grid', gridTemplateColumns: '112px 1fr 52px', alignItems: 'center', gap: 8 }}>
        <span style={{ font: '400 12px/1 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{lang === 'hi' ? hi : en}</span>
        <span style={{ position: 'relative', height: 6, background: 'var(--vs-line-ghost)' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (v == null ? 0 : Math.min(100, v / max * 100)) + '%', background: lvl ? LEVEL_TONE[lvl] : 'transparent' }}></span>
          <span title="attention threshold" style={{ position: 'absolute', top: -2, bottom: -2, width: 1, left: Math.min(100, t.attention / max * 100) + '%', background: 'var(--vs-amber)' }}></span>
          {t.critical != null ? <span title="critical threshold" style={{ position: 'absolute', top: -2, bottom: -2, width: 1, left: Math.min(100, t.critical / max * 100) + '%', background: 'var(--vs-red)' }}></span> : null}
        </span>
        <span style={{ ...mono(12, 600), textAlign: 'right', color: lvl ? LEVEL_TONE[lvl] : 'var(--text-muted)' }}>{v == null ? '—' : v.toFixed(1) + '°'}</span>
      </div>;
    })}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
      <span style={{ ...mono(11), color: 'var(--text-muted)' }}>VIS {m ? m.visibility.toFixed(2) : '—'} · {calibrated ? 'CALIBRATED' : 'ABSOLUTE'}</span>
      <Button size="sm" variant="ghost" icon="reset" onClick={onCalibrate} disabled={!m} title="Use the current posture as the neutral baseline">Calibrate</Button>
    </div>
  </div>;
}

function GestureStrip({ snap, lastGesture, handsOn, lang }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="hand" size={14} color="#fff" /><span style={{ ...caps, color: '#fff' }}>{lang === 'hi' ? 'हाथ' : 'HANDS'}</span>
      <span style={{ marginLeft: 'auto', ...mono(11, 600), color: handsOn ? '#fff' : 'var(--text-muted)' }}>{handsOn ? snap.hands.length + ' TRACKED' : 'TRACKING OFF'}</span>
    </div>
    {['Left', 'Right'].map(side => {
      const h = snap.hands.find(x => x.side === side);
      return <div key={side} style={{ display: 'grid', gridTemplateColumns: '46px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', border: '1px solid ' + (h && h.gesture ? 'var(--vs-amber)' : 'var(--border-panel)') }}>
        <span style={{ ...mono(11, 600), color: h ? '#fff' : 'var(--text-muted)' }}>{side.toUpperCase()}</span>
        <span style={{ font: '500 13px/1 var(--font-sans)', color: h ? (h.gesture ? 'var(--vs-amber)' : '#fff') : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {h ? (h.gesture ? GESTURES[h.gesture].label : 'Tracked · ' + (h.raw === 'None' ? 'no gesture' : h.raw.replace('_', ' '))) : 'Not in view'}</span>
        <span style={{ ...mono(11), color: 'var(--text-muted)' }}>{h ? (h.gesture ? h.score.toFixed(2) : h.handScore.toFixed(2)) + ' · ' + h.x.toFixed(2) + ',' + h.y.toFixed(2) : ''}</span>
      </div>;
    })}
    <div style={{ ...mono(11), color: 'var(--text-muted)', lineHeight: 1.5 }}>
      {lastGesture ? <>LAST · <span style={{ color: 'var(--vs-amber)' }}>{GESTURES[lastGesture.gesture].label.toUpperCase()}</span> · {lastGesture.side.toUpperCase()} {lastGesture.score.toFixed(2)} · {new Date(lastGesture.at).toISOString().slice(11, 19)}<br />→ {lastGesture.action}</> : 'Palm = status · Fist = pause · Thumbs up = confirm step · Point = select · Pinch = action'}
    </div>
  </div>;
}

function DetectStrip({ objects, detections, objInfo, pointing, selected, motion, lang }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="box" size={14} color="#fff" /><span style={{ ...caps, color: '#fff' }}>{lang === 'hi' ? 'वस्तुएँ' : 'OBJECTS'}</span>
      <span style={{ marginLeft: 'auto', ...mono(11, 600), color: objInfo.tone }}>{objInfo.label}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 84 }}>
      {objects === 'off' ? <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-muted)' }}>Object detection is off. Choose BROWSER (EfficientDet-Lite0) or BACKEND (YOLOv8) above.</span>
        : objInfo.unavailable ? <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--vs-amber)' }}>{objInfo.reason}</span>
          : detections.length === 0 ? <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-muted)' }}>No objects detected in the current frame.</span>
            : detections.slice(0, 4).map(d => {
              const hot = (pointing && pointing.target && pointing.target.id === d.id && pointing.target.label === d.label) || (selected && selected.id === d.id && selected.label === d.label);
              return <div key={d.label + d.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', ...mono(12, hot ? 600 : 500), color: hot ? 'var(--vs-amber)' : '#fff' }}>
                <span>{(hot ? '▸ ' : '') + d.label.toUpperCase()}{d.id != null ? ' #' + d.id : ''}</span><span>{d.conf.toFixed(2)}</span></div>;
            })}
    </div>
    <div style={{ ...mono(11), color: 'var(--text-muted)', lineHeight: 1.5 }}>
      SELECTED · <span style={{ color: selected ? 'var(--vs-amber)' : undefined }}>{selected ? selected.label.toUpperCase() + (selected.id != null ? ' #' + selected.id : '') : '—'}</span><br />
      MOTION · {motion.ready ? (motion.energy * 100).toFixed(1) + '% · ' + motion.contours + ' regions · ' + motion.ms.toFixed(0) + ' ms' : motion.state}
    </div>
  </div>;
}

export function Monitor(p) {
  const { cam, monitoring, paused, opts, setOpt, snap, vision, onStart, onStop, onPause, onCalibrate, calibrated, onSnapshot, videoRef, canvasRef,
    alert, toast, lang, objInfo, detections, lastGesture, selected, motion, children } = p;
  const live = cam.state === 'active';
  const vid = snap.video || (cam.info ? { w: cam.info.width, h: cam.info.height } : { w: 16, h: 9 });
  const aspect = vid.w && vid.h ? vid.w / vid.h : 16 / 9;
  const bw = Math.min(VW, VH * aspect), bh = bw / aspect;
  const crit = alert && alert.level === 'critical';

  return <Panel padding={0} tone={crit ? 'red' : alert && alert.level === 'attention' ? 'amber' : undefined} style={{ height: 790, background: 'transparent' }} bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
    <div style={{ position: 'relative', width: VW, height: VH, background: '#000', overflow: 'hidden', flex: 'none' }}>
      {!live ? <div style={{ position: 'absolute', inset: 0, opacity: .55 }}><Hologram width={VW} height={VH} verified={3} intent={null} drift={false} alert={null} objects={{}} /></div> : null}
      <div style={{ position: 'absolute', left: (VW - bw) / 2, top: (VH - bh) / 2, width: bw, height: bh, display: live ? 'block' : 'none' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', display: 'block', transform: opts.mirror ? 'scaleX(-1)' : 'none', background: '#000' }}></video>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}></canvas>
      </div>
      {!live ? <div style={{ position: 'absolute', left: 16, bottom: 12, ...mono(11), color: 'var(--text-muted)', letterSpacing: '.06em', zIndex: 2 }}>SCENE MODEL · ILLUSTRATIVE, NOT LIVE DATA</div> : null}
      {!live ? <IdleCard cam={cam} onStart={onStart} vision={vision} /> : null}
      {live ? <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(0,0,0,.7)', border: '1px solid var(--border-default)', ...mono(11, 600), color: '#fff', zIndex: 2 }}>
        <Dot tone={paused ? 'amber' : 'red'} blink={!paused} />{paused ? 'PAUSED' : 'LIVE'} · {(cam.info && cam.info.label || 'CAMERA').toUpperCase().slice(0, 28)} · {vid.w}×{vid.h} · {Math.round(snap.fps)} FPS</div> : null}
      {live && alert ? <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', zIndex: 2,
        border: '1px solid ' + (crit ? 'var(--vs-red)' : 'var(--vs-amber)'), background: 'rgba(0,0,0,.85)', color: crit ? 'var(--vs-red)' : 'var(--vs-amber)', ...mono(13, 600), letterSpacing: '.1em', whiteSpace: 'nowrap',
        boxShadow: crit ? 'var(--glow-red)' : 'var(--glow-amber)', animation: crit ? 'vsBlink 1.1s ease-in-out infinite' : 'none' }}>
        <Icon name={crit ? 'octagon-alert' : 'triangle-alert'} size={16} />POSTURE {crit ? 'CRITICAL' : 'ATTENTION'} · {alert.summary}</div> : null}
      {live && paused ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 1 }}>
        <span style={{ padding: '10px 16px', background: 'rgba(0,0,0,.8)', border: '1px solid var(--vs-amber)', color: 'var(--vs-amber)', ...mono(13, 600), letterSpacing: '.12em' }}>MONITORING PAUSED · CLOSED FIST OR “RESUME MONITORING” TO CONTINUE</span></div> : null}
      {live && toast ? <div key={toast.key} style={{ position: 'absolute', right: 14, bottom: 14, maxWidth: 520, padding: '8px 12px', background: 'rgba(0,0,0,.85)', border: '1px solid var(--vs-amber)', color: '#fff', font: '500 13px/1.35 var(--font-sans)', zIndex: 2, animation: 'vsRise .3s var(--ease-out)' }}>
        <span style={{ ...mono(11, 600), color: 'var(--vs-amber)', letterSpacing: '.08em', display: 'block', marginBottom: 3 }}>{toast.title}</span>{toast.text}</div> : null}
      {children}
    </div>
    {/* control bar */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px', borderTop: '1px solid var(--border-divider)', borderBottom: '1px solid var(--border-divider)', background: 'var(--surface-panel-header)', flex: 'none' }}>
      {live ? <Button variant="critical" icon="square" onClick={onStop}>Stop</Button> : <Button variant="primary" icon="play" onClick={onStart} disabled={cam.state === 'requesting' || cam.state === 'unsupported' || cam.state === 'insecure'}>Start monitoring</Button>}
      <Button variant="secondary" icon={paused ? 'play' : 'pause'} onClick={onPause} disabled={!live}>{paused ? 'Resume' : 'Pause'}</Button>
      <span style={{ width: 1, height: 22, background: 'var(--border-default)', margin: '0 4px' }}></span>
      <Chip onClick={() => setOpt('hands', !opts.hands)} active={opts.hands} tone="white" title="MediaPipe GestureRecognizer (hand landmarks + gestures)">HANDS</Chip>
      <Chip onClick={() => setOpt('pose', !opts.pose)} active={opts.pose} tone="white" title="MediaPipe PoseLandmarker (posture)">POSE</Chip>
      <Chip onClick={() => setOpt('motion', !opts.motion)} active={opts.motion} tone="white" title="OpenCV.js frame differencing + contours">MOTION</Chip>
      <span style={{ ...mono(11), color: 'var(--text-muted)', marginLeft: 6 }}>OBJECTS</span>
      {['off', 'browser', 'backend'].map(k => <Chip key={k} onClick={() => setOpt('objects', k)} active={opts.objects === k} tone="white"
        title={k === 'browser' ? 'MediaPipe EfficientDet-Lite0 in the browser' : k === 'backend' ? 'YOLOv8 on the Python backend' : 'No object detection'}>{k.toUpperCase()}</Chip>)}
      <span style={{ flex: 1 }}></span>
      <Button size="sm" variant="ghost" icon="camera" onClick={onSnapshot} disabled={!live}>Snapshot</Button>
    </div>
    {/* analysis strip */}
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 18, padding: '12px 14px' }}>
      <PostureStrip snap={snap} pose={opts.pose && live} onCalibrate={onCalibrate} calibrated={calibrated} lang={lang} />
      <GestureStrip snap={snap} lastGesture={lastGesture} handsOn={opts.hands && live} lang={lang} />
      <DetectStrip objects={opts.objects} detections={detections} objInfo={objInfo} pointing={snap.pointing} selected={selected} motion={motion} lang={lang} />
    </div>
  </Panel>;
}
