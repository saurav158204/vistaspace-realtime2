import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Button, Legend, Icon, StatusBadge } from '../ds';
import { TopBar } from './TopBar.jsx';
import { LeftColumn } from './LeftColumn.jsx';
import { RightColumn } from './RightColumn.jsx';
import { Monitor, LEVEL_TEXT } from './Monitor.jsx';
import { Guidance } from './Guidance.jsx';
import { VoiceConsole } from './VoiceConsole.jsx';
import { Chip, mono, utcClock, n } from './ui.jsx';
import { useCamera } from '../live/camera.js';
import { VisionEngine } from '../live/vision.js';
import { GESTURES, GESTURE_CONFIG } from '../live/gestures.js';
import { POSTURE_THRESHOLDS } from '../live/posture.js';
import { useMissionLog, toCSV, download, timeOf } from '../live/log.js';
import { useProcedure, evaluateRule, describeRule } from '../live/procedure.js';
import { useBackend, useBackendDetector, DEFAULT_BACKEND } from '../live/backend.js';
import { useSystemMetrics } from '../live/system.js';
import { useRecognition, useSpeaking, speak, cancelSpeech, ttsSupported } from '../live/voice.js';
import { parseCommand, COMMANDS } from '../live/commands.js';

const PINCH_ACTIONS = { capture: 'Capture evidence snapshot', complete: 'Mark current step complete', toggle_hands: 'Toggle hand tracking', status: 'Speak monitoring status' };
const METRIC_LABEL = { headTilt: 'head tilt', neck: 'neck alignment', shoulderLevel: 'shoulder level', torsoLean: 'torso lean', arm: 'arm elevation' };
const TEMP_LIMITS = { ambient_temp_c: 30, device_temp_c: 70 }; // °C, raise a warning above these
let itemSeq = 0;

function reasonText(reasons) {
  return reasons.slice().sort((a, b) => (a.level === b.level ? b.value - a.value : a.level === 'critical' ? -1 : 1))
    .map(r => METRIC_LABEL[r.key] + ' ' + Math.round(r.value) + '°').join(', ');
}

const emptySnap = { fps: 0, inferenceMs: 0, ms: {}, hands: [], pose: null, posture: { level: 'unknown', reasons: [] }, pointing: null, video: null, detections: [] };

export default function App() {
  const [lang, setLang] = useState('en');
  const [scale, setScale] = useState(1);
  const cam = useCamera();
  const canvasRef = useRef(null);
  const [opts, setOpts] = useState({ hands: true, pose: true, motion: true, objects: 'off', mirror: true });
  const [vstat, setVstat] = useState({ status: { hands: 'off', pose: 'off', objects: 'off', motion: 'off' }, errors: {}, delegate: {} });
  const [monitoring, setMonitoring] = useState(false);
  const [paused, setPaused] = useState(false);
  const [monStart, setMonStart] = useState(null);
  const [snap, setSnap] = useState(emptySnap);
  const [motionSeries, setMotionSeries] = useState([]);
  const [confSeries, setConfSeries] = useState([]);
  const [speed, setSpeed] = useState(null);
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [lastGesture, setLastGesture] = useState(null);
  const [lastBySide, setLastBySide] = useState({});
  const [gestureCount, setGestureCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [voiceOut, setVoiceOut] = useState(true);
  const [alertsMuted, setAlertsMuted] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [focus, setFocus] = useState(null);
  const [pinchAction, setPinchAction] = useState('capture');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND);
  const [calibrated, setCalibrated] = useState(false);
  const [rule, setRule] = useState(null);
  const [clock, setClock] = useState(() => new Date());

  const be = useBackend(backendUrl);
  const log = useMissionLog(be.postEvent);
  const proc = useProcedure(log.add);
  const sys = useSystemMetrics();
  const speaking = useSpeaking();

  const handlers = useRef({});
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new VisionEngine({
    onStatus: (status, errors, delegate) => setVstat({ status, errors, delegate }),
    onGesture: e => handlers.current.onGesture(e),
    onPosture: e => handlers.current.onPosture(e),
  });
  const engine = engineRef.current;
  const trailRef = useMemo(() => ({ get current() { return engineRef.current.trail; } }), []);
  const detector = useBackendDetector(backendUrl, engineRef, monitoring && !paused && opts.objects === 'backend');

  // live refs for callbacks
  const S = useRef({}); S.current = { proc, monitoring, paused, opts, lang, voiceOut, alertsMuted, alert, snap, be, cam, sys, pinchAction, detector, vstat };
  const lastSpoken = useRef('');
  const say = useCallback((text, { alert: isAlert = false, interrupt = false } = {}) => {
    const s = S.current; if (!text) return;
    lastSpoken.current = text;
    if (!s.voiceOut || (isAlert && s.alertsMuted)) return;
    speak(text, 'en', { interrupt });
  }, []);
  const showToast = useCallback((title, text) => setToast({ key: Date.now(), title, text }), []);
  useEffect(() => { if (!toast) return undefined; const id = setTimeout(() => setToast(null), 3500); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { if (!focus) return undefined; const id = setTimeout(() => setFocus(null), 4000); return () => clearTimeout(id); }, [focus]);

  useEffect(() => { const f = () => setScale(Math.min(innerWidth / 1920, innerHeight / 1080)); f(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { engine.setOptions(opts); }, [opts, engine]);
  useEffect(() => { engine.paused = paused; }, [paused, engine]);

  // ---------------------------------------------------------------- monitoring lifecycle
  const startMonitoring = useCallback(async (via = 'manual') => {
    if (S.current.monitoring) return 'Monitoring is already running.';
    const st = await cam.start();
    if (st !== 'active') {
      log.add({ kind: 'system', level: 'warning', title: 'CAMERA ' + st.toUpperCase(), message: 'Monitoring could not start (' + via + ')' });
      return 'Could not start monitoring: camera ' + st.replace('-', ' ') + '.';
    }
    engine.setOptions(S.current.opts); engine.paused = false;
    engine.start(cam.videoRef.current, canvasRef.current);
    setMonitoring(true); setPaused(false); setMonStart(Date.now()); setMotionSeries([]); setConfSeries([]);
    log.add({ kind: 'session', level: 'info', title: 'MONITORING STARTED', message: 'Camera on · hands ' + (S.current.opts.hands ? 'on' : 'off') + ' · pose ' + (S.current.opts.pose ? 'on' : 'off') + ' · via ' + via });
    return 'Monitoring started. Camera is live.';
  }, [cam, engine, log]);

  const stopMonitoring = useCallback((via = 'manual', reason) => {
    const was = S.current.monitoring;
    engine.stop(); cam.stop();
    setMonitoring(false); setPaused(false); setSnap(emptySnap); setAlert(null); setRule(null); setSpeed(null); setMonStart(null);
    if (was) log.add({ kind: 'session', level: reason ? 'critical' : 'info', title: reason ? 'MONITORING STOPPED · ' + reason : 'MONITORING STOPPED', message: 'Camera released · via ' + via });
    return was ? 'Monitoring stopped. The camera is released.' : 'Monitoring was not running.';
  }, [cam, engine, log]);

  const togglePause = useCallback((via = 'manual') => {
    if (!S.current.monitoring) return 'Monitoring is not running.';
    const next = !S.current.paused; setPaused(next); engine.paused = next;
    log.add({ kind: 'session', level: next ? 'warning' : 'info', title: next ? 'MONITORING PAUSED' : 'MONITORING RESUMED', message: 'via ' + via });
    return next ? 'Monitoring paused. Make a fist or say resume monitoring to continue.' : 'Monitoring resumed.';
  }, [engine, log]);

  // camera unplugged / revoked while running
  useEffect(() => {
    if (monitoring && cam.state !== 'active' && cam.state !== 'requesting') {
      engine.stop(); setMonitoring(false); setPaused(false); setSnap(emptySnap);
      log.add({ kind: 'system', level: 'critical', title: 'CAMERA ' + cam.state.toUpperCase(), message: cam.text });
      say('Warning. Camera ' + cam.state + '. Monitoring stopped.', { alert: true, interrupt: true });
    }
  }, [cam.state, monitoring, engine, log, cam.text, say]);

  // ---------------------------------------------------------------- evidence + step completion
  const context = useCallback(() => {
    const s = S.current.snap;
    return { posture: s.posture.level, objects: s.detections.map(d => d.label + (d.id != null ? '#' + d.id : '')),
      hands: s.hands.map(h => h.side + ':' + (h.gesture || 'tracked')), fps: Math.round(s.fps) };
  }, []);

  const completeStep = useCallback((method, confidence, extra = {}, quiet = false) => {
    const s = S.current;
    if (s.proc.done) return 'The procedure is already complete.';
    const snapshot = s.monitoring ? engine.snapshot() : null;
    const res = s.proc.complete(method, { confidence, evidence: { snapshot }, details: { ...context(), ...extra } });
    if (!res) return 'Nothing to complete.';
    const nxt = s.proc.steps[s.proc.index + 1];
    const msg = res.step.id + ' verified by ' + method + '.' + (nxt ? ' Next: ' + nxt.instruction + '.' : ' Procedure complete.');
    showToast(res.step.id + ' VERIFIED · ' + method.toUpperCase(), msg);
    if (!quiet) say(msg);
    return msg;
  }, [engine, context, say, showToast]);

  const capture = useCallback((via) => {
    if (!S.current.monitoring) return 'Start monitoring to capture evidence.';
    const snapshot = engine.snapshot();
    log.add({ kind: 'evidence', level: 'info', title: 'EVIDENCE CAPTURED', message: 'Snapshot via ' + via + ' · ' + (context().objects.join(', ') || 'no objects'), data: { snapshot, ...context() } });
    showToast('EVIDENCE CAPTURED', 'Snapshot saved to the mission log.');
    return 'Evidence snapshot captured.';
  }, [engine, log, context, showToast]);

  const statusText = useCallback(() => {
    const s = S.current;
    if (!s.monitoring) return 'Monitoring is off. Say start monitoring, or press Start.';
    const p = s.opts.pose ? 'posture ' + LEVEL_TEXT[s.snap.posture.level].toLowerCase() : 'pose tracking off';
    const step = s.proc.current ? 'current step ' + s.proc.current.id + ', ' + s.proc.current.title : 'procedure complete';
    return 'Monitoring ' + (s.paused ? 'paused' : 'active') + ' at ' + Math.round(s.snap.fps) + ' frames per second, ' + s.snap.hands.length + ' hands tracked, ' + p + ', ' + step + '.';
  }, []);

  // ---------------------------------------------------------------- gestures
  handlers.current.onGesture = (e) => {
    const s = S.current; let action;
    switch (e.gesture) {
      case 'open_palm': action = 'status shown'; { const t = statusText(); showToast('MONITORING STATUS', t); say(t); } break;
      case 'fist': action = s.paused ? 'monitoring resumed' : 'monitoring paused'; togglePause('gesture'); break;
      case 'thumbs_up':
        if (s.paused) action = 'ignored (paused)';
        else if (s.proc.done) action = 'procedure already complete';
        else { const id = s.proc.current.id; completeStep('gesture', e.score, { gesture: 'thumbs_up', hand: e.side }); action = id + ' confirmed'; }
        break;
      case 'pointing':
        if (e.target) { setSelected(e.target); action = 'selected ' + e.target.label + (e.target.id != null ? ' #' + e.target.id : ''); showToast('TARGET SELECTED', e.target.label.toUpperCase() + ' · conf ' + e.target.conf.toFixed(2)); }
        else action = s.opts.objects === 'off' ? 'no target (object detection off)' : 'no detected target in pointing direction';
        break;
      case 'pinch':
        action = PINCH_ACTIONS[s.pinchAction];
        if (s.pinchAction === 'capture') capture('pinch');
        else if (s.pinchAction === 'complete') completeStep('gesture', e.score, { gesture: 'pinch', hand: e.side });
        else if (s.pinchAction === 'toggle_hands') setOpts(o => ({ ...o, hands: !o.hands }));
        else { const t = statusText(); showToast('MONITORING STATUS', t); say(t); }
        break;
      default: action = '—';
    }
    const g = { ...e, action };
    setLastGesture(g); setLastBySide(m => ({ ...m, [e.side]: g })); setGestureCount(c => c + 1);
    log.add({ kind: 'gesture', level: 'info', title: GESTURES[e.gesture].label.toUpperCase(), message: e.side + ' hand · ' + e.score.toFixed(2) + ' · → ' + action,
      data: { gesture: e.gesture, hand: e.side, confidence: +e.score.toFixed(3), x: +e.x.toFixed(3), y: +e.y.toFixed(3), action, target: e.target || null } });
  };

  // ---------------------------------------------------------------- posture
  handlers.current.onPosture = ({ level, reasons, metrics }) => {
    const s = S.current;
    if (level === 'critical' || level === 'attention') {
      const detail = reasonText(reasons);
      setAlert({ kind: 'posture', level, title: level === 'critical' ? 'Posture critical' : 'Posture needs attention', detail, summary: detail.split(',')[0].toUpperCase(), time: utcClock(new Date()), acked: null });
      log.add({ kind: 'posture', level: level === 'critical' ? 'critical' : 'warning', title: 'POSTURE ' + LEVEL_TEXT[level], message: detail,
        data: { level, reasons: reasons.map(r => ({ metric: r.key, value: +r.value.toFixed(1), level: r.level })), visibility: metrics && +metrics.visibility.toFixed(2) } });
      say((level === 'critical' ? 'Warning. Posture critical: ' : 'Posture needs attention: ') + detail.replace(/°/g, ' degrees') + '.', { alert: true, interrupt: level === 'critical' });
    } else if (level === 'nominal') {
      if (s.alert && s.alert.kind === 'posture') { setAlert(null); log.add({ kind: 'posture', level: 'verified', title: 'POSTURE NOMINAL', message: 'Back within thresholds' }); }
    }
  };

  const ack = useCallback(() => {
    const a = S.current.alert; if (!a || a.acked) return 'There is no active alert.';
    setAlert({ ...a, acked: utcClock(new Date()) });
    log.add({ kind: 'alert', level: 'info', title: 'ALERT ACKNOWLEDGED', message: a.title + ' · ' + a.detail });
    return 'Alert acknowledged.';
  }, [log]);

  // ---------------------------------------------------------------- 5 Hz sampling of the engine + auto rules
  const hold = useRef(null);
  useEffect(() => {
    if (!monitoring) return undefined;
    const id = setInterval(() => {
      const L = engine.latest; const s = S.current;
      const hands = L.hands.map(h => { const q = engine.displayPoint(h.center); return { side: h.side, gesture: h.gesture, score: h.score, handScore: h.handScore, raw: h.raw, x: q.x, y: q.y }; });
      const dets = engine.allDetections();
      const next = { fps: L.fps, inferenceMs: L.inferenceMs, ms: { ...L.ms }, hands, pose: L.pose ? { metrics: L.pose.metrics } : null, posture: { ...L.posture }, pointing: L.pointing, video: L.video, detections: dets };
      setSnap(next);
      if (engine.status.motion === 'ready') setMotionSeries(a => [...a.slice(-59), engine.motion.energy * 100]);
      setConfSeries(a => [...a.slice(-59), { pose: L.pose ? L.pose.metrics.visibility * 100 : null, hand: hands.length ? hands.reduce((x, h) => x + h.handScore, 0) / hands.length * 100 : null }]);
      // palm speed from the engine's trail (last 300 ms)
      const t = performance.now(); let best = null;
      for (const side of ['Left', 'Right']) { const tr = engine.trail[side].filter(p => t - p.t < 300); if (tr.length > 1) { const a = tr[0], b = tr[tr.length - 1]; const v = Math.hypot(b.x - a.x, b.y - a.y) / ((b.t - a.t) / 1000 || 1); best = Math.max(best || 0, v); } }
      setSpeed(best);
      // auto-completion rule of the current step
      const step = s.proc.current;
      if (!step || !step.auto || s.paused) { hold.current = null; setRule(step && step.auto ? { ok: false, hold: 0, blocked: s.paused ? 'paused' : null } : null); return; }
      const detAvail = s.opts.objects === 'browser' ? engine.status.objects === 'ready' : s.opts.objects === 'backend' ? s.detector.state === 'ready' : false;
      const r = evaluateRule(step.auto, { monitoring: true, pose: next.pose, posture: next.posture.level, hands, detections: dets, detectorAvailable: detAvail, poseEnabled: s.opts.pose, handsEnabled: s.opts.hands });
      if (r.ok) {
        if (!hold.current || hold.current.step !== step.id) hold.current = { step: step.id, since: Date.now(), confs: [] };
        hold.current.confs.push(r.conf);
        const frac = (Date.now() - hold.current.since) / (step.auto.seconds * 1000);
        setRule({ ...r, hold: Math.min(1, frac) });
        if (frac >= 1) {
          const conf = hold.current.confs.reduce((a, b) => a + b, 0) / hold.current.confs.length;
          hold.current = null;
          completeStep('auto', conf, { rule: describeRule(step.auto) });
        }
      } else { hold.current = null; setRule({ ...r, hold: 0 }); }
    }, 200);
    return () => clearInterval(id);
  }, [monitoring, engine, completeStep]);

  // ---------------------------------------------------------------- sensors: source changes + temperature limits
  const prevLabel = useRef(be.label);
  useEffect(() => {
    if (prevLabel.current === be.label) return;
    log.add({ kind: 'sensor', level: be.label === 'DISCONNECTED' ? 'warning' : be.label === 'SIMULATED FALLBACK' ? 'drift' : 'info', title: 'SENSOR SOURCE · ' + be.label, message: 'was ' + prevLabel.current });
    prevLabel.current = be.label;
  }, [be.label, log]);
  const over = useRef({});
  useEffect(() => {
    const r = be.reading && be.reading.reading; if (!r) return;
    for (const [k, lim] of Object.entries(TEMP_LIMITS)) {
      const v = r[k]; if (v == null) continue;
      if (v > lim && !over.current[k]) {
        over.current[k] = true;
        const txt = (k === 'ambient_temp_c' ? 'Ambient' : 'Device') + ' temperature ' + v.toFixed(1) + ' °C above ' + lim + ' °C';
        log.add({ kind: 'sensor', level: 'warning', title: 'TEMPERATURE HIGH · ' + be.label, message: txt + ' (' + r.device_id + ')', data: { [k]: v, source: be.reading.source } });
        showToast('TEMPERATURE HIGH', txt + ' · ' + be.label);
        say('Warning. ' + txt.replace('°C', 'degrees') + (be.reading.source === 'simulated' ? ', simulated data.' : '.'), { alert: true });
      } else if (v <= lim - 0.5) over.current[k] = false;
    }
  }, [be.reading, be.label, log, showToast, say]);

  // ---------------------------------------------------------------- commands (voice + typed): every command calls real functions
  const setOpt = useCallback((k, v) => {
    setOpts(o => ({ ...o, [k]: v }));
    log.add({ kind: 'config', level: 'info', title: k.toUpperCase() + ' ' + (typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : String(v).toUpperCase()), message: 'Tracking option changed' });
  }, [log]);

  const run = useCallback(async (cmd, via) => {
    const s = S.current; const P = s.proc;
    switch (cmd) {
      case 'start_monitoring': return s.monitoring && s.paused ? togglePause(via) : startMonitoring(via);
      case 'stop_monitoring': return stopMonitoring(via);
      case 'pause_monitoring': return s.paused ? 'Monitoring is already paused.' : togglePause(via);
      case 'hands_on': setOpt('hands', true); return 'Hand tracking enabled.';
      case 'hands_off': setOpt('hands', false); return 'Hand tracking disabled. Gestures are off until you enable it.';
      case 'pose_on': setOpt('pose', true); return 'Pose tracking enabled.';
      case 'pose_off': setOpt('pose', false); return 'Pose tracking disabled. Posture is no longer assessed.';
      case 'calibrate': if (engine.calibrate()) { setCalibrated(true); log.add({ kind: 'posture', level: 'info', title: 'POSTURE CALIBRATED', message: 'Current posture set as neutral baseline' }); return 'Posture calibrated to your current neutral position.'; } return 'Cannot calibrate: no body detected.';
      case 'posture_status': {
        if (!s.monitoring) return 'Monitoring is off, so posture is not being assessed.';
        if (!s.opts.pose) return 'Pose tracking is disabled.';
        const P2 = s.snap.posture; const d = P2.dev;
        if (P2.level === 'unknown' || !d) return 'Posture not assessed: your head and shoulders are not clearly in view.';
        return 'Posture ' + LEVEL_TEXT[P2.level].toLowerCase() + '. Head tilt ' + n(d.headTilt, 0) + ', neck ' + n(d.neck, 0) + ', shoulders ' + n(d.shoulderLevel, 0) + (d.torsoLean != null ? ', torso ' + n(d.torsoLean, 0) : '') + ' degrees.';
      }
      case 'read_procedure': return P.current ? P.current.id + ' of ' + P.steps.length + ', ' + P.current.title + ': ' + P.current.instruction + '.' : 'The procedure is complete.';
      case 'next_step': { const st = P.next(via); if (!st) return 'There is no next step.'; const nx = P.steps[P.index + 1]; return 'Skipped ' + st.id + '. ' + (nx ? 'Now ' + nx.id + ': ' + nx.instruction + '.' : 'Procedure finished.'); }
      case 'prev_step': { const st = P.prev(via); return st ? 'Reopened ' + st.id + ': ' + st.instruction + '.' : 'Already at the first step.'; }
      case 'repeat': return lastSpoken.current || (P.current ? P.current.instruction : 'Nothing to repeat.');
      case 'mute_alerts': setAlertsMuted(true); log.add({ kind: 'config', level: 'info', title: 'VOICE ALERTS MUTED', message: 'via ' + via }); return 'Voice alerts muted. Visual alerts stay on.';
      case 'unmute_alerts': setAlertsMuted(false); log.add({ kind: 'config', level: 'info', title: 'VOICE ALERTS ON', message: 'via ' + via }); return 'Voice alerts are on.';
      case 'temperature': {
        setFocus('telemetry');
        const r = s.be.reading && s.be.reading.reading;
        if (!r) return 'No temperature data. Sensor source is ' + s.be.label.toLowerCase() + '.';
        const src = s.be.reading.source === 'simulated' ? 'Simulated fallback data, not a live sensor.' : 'Source ' + s.be.label.toLowerCase() + ' via ' + s.be.reading.transport + '.';
        return 'Ambient ' + n(r.ambient_temp_c, 1) + ' degrees, device ' + n(r.device_temp_c, 1) + ' degrees, humidity ' + n(r.humidity_pct, 0) + ' percent. ' + src;
      }
      case 'system_health': {
        setFocus('health');
        const parts = [s.monitoring ? 'Camera live at ' + Math.round(s.snap.fps) + ' frames per second, inference ' + Math.round(s.snap.inferenceMs) + ' milliseconds' : 'Camera off',
          'backend ' + s.be.conn, 'network ' + (s.sys.online ? 'online' : 'offline')];
        if (s.sys.heap) parts.push('script memory ' + Math.round(s.sys.heap.used) + ' megabytes');
        if (s.sys.battery) parts.push('battery ' + Math.round(s.sys.battery.level * 100) + ' percent');
        if (s.be.host) parts.push('backend host CPU ' + Math.round(s.be.host.cpu_percent) + ' percent');
        return parts.join(', ') + '.';
      }
      case 'monitoring_status': return statusText();
      case 'complete_step': return completeStep(via === 'voice' ? 'voice' : 'manual', via === 'voice' ? s.lastConf ?? null : null, { command: 'mark step complete', via }, true);
      case 'capture': return capture(via);
      case 'lang_hi': setLang('hi'); return 'Interface switched to Hindi.';
      case 'lang_en': setLang('en'); return 'Interface switched to English.';
      case 'help': return 'Commands: ' + COMMANDS.filter(c => !c.id.startsWith('lang')).map(c => c.en).join(', ') + '.';
      default: return null;
    }
  }, [startMonitoring, stopMonitoring, togglePause, setOpt, engine, log, completeStep, capture, statusText]);

  const recRef = useRef(null);
  const handleUtterance = useCallback(async (text, conf, via) => {
    const time = utcClock(new Date());
    S.current.lastConf = conf;
    setItems(a => [...a, { id: ++itemSeq, role: 'user', text, via, conf, time }].slice(-40));
    const cmd = parseCommand(text);
    const reply = cmd ? await run(cmd, via) : null;
    const out = reply || 'Not a command I know. Try “start monitoring”, “what is my posture status?” or “mark step complete”. Say “help” for all commands.';
    setItems(a => [...a, { id: ++itemSeq, role: 'vista', text: out, cmd, ok: !!cmd, time: utcClock(new Date()) }].slice(-40));
    log.add({ kind: 'voice', level: cmd ? 'info' : 'warning', title: cmd ? 'COMMAND · ' + cmd.toUpperCase() : 'UNRECOGNISED COMMAND', message: '“' + text + '”' + (conf != null ? ' · ' + conf.toFixed(2) : '') + ' · ' + via, data: { text, command: cmd, confidence: conf, via, reply: out } });
    say(out);
    if (recRef.current) recRef.current.done();
  }, [run, log, say]);

  const rec = useRecognition((text, conf) => handleUtterance(text, conf, 'voice'));
  recRef.current = rec;
  const openVoice = useCallback(() => { setConsoleOpen(true); if (rec.supported && rec.state !== 'listening') { cancelSpeech(); rec.listen(S.current.lang); } }, [rec]);

  // test/debug hook: runs text through exactly the same path as recognised speech
  useEffect(() => { window.__vista = { command: (t) => handleUtterance(t, null, 'test'), engine, log: () => log.events }; }, [handleUtterance, engine, log.events]);

  // keyboard
  useEffect(() => {
    const onKey = e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); openVoice(); }
      else if (e.key === 'Escape') { if (drawer) setDrawer(null); else setConsoleOpen(false); }
      else if (e.key === 'a' || e.key === 'A') ack();
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [openVoice, drawer, ack]);

  // ---------------------------------------------------------------- derived view data
  const vs = vstat.status;
  const loading = Object.entries(vs).some(([k, v]) => v === 'loading' && (k !== 'objects' || opts.objects === 'browser'));
  const errored = Object.keys(vstat.errors).length > 0;
  const vision = !monitoring ? { label: 'OFF', tone: 'var(--text-muted)' } : paused ? { label: 'PAUSED', tone: 'var(--vs-amber)' } : loading ? { label: 'LOADING', tone: '#fff' } : errored ? { label: 'ERROR', tone: 'var(--vs-red)' } : { label: 'LIVE', tone: 'var(--vs-green)' };
  const delegates = [...new Set(Object.values(vstat.delegate))].join('/') || '—';
  const visionLine = 'MediaPipe ' + (delegates !== '—' ? delegates : '') + ' · hands ' + vs.hands + ' · pose ' + vs.pose + ' · OpenCV ' + vs.motion;

  let objInfo;
  if (opts.objects === 'off') objInfo = { label: 'OFF', tone: 'var(--text-muted)' };
  else if (opts.objects === 'browser') objInfo = vs.objects === 'ready' ? { label: 'EFFICIENTDET · BROWSER', tone: 'var(--vs-green)' } : vs.objects === 'error' ? { label: 'UNAVAILABLE', tone: 'var(--vs-amber)', unavailable: true, reason: 'Browser detector failed to load: ' + vstat.errors.objects } : { label: 'LOADING', tone: '#fff' };
  else objInfo = be.conn !== 'connected' ? { label: 'UNAVAILABLE', tone: 'var(--vs-amber)', unavailable: true, reason: 'Backend not connected — YOLOv8 detection unavailable. Start the backend or use BROWSER.' }
    : detector.state === 'unavailable' ? { label: 'UNAVAILABLE', tone: 'var(--vs-amber)', unavailable: true, reason: 'Backend detector unavailable: ' + detector.reason }
      : detector.state === 'ready' ? { label: 'YOLOV8 · BACKEND' + (detector.inferenceMs ? ' · ' + Math.round(detector.inferenceMs) + ' MS' : ''), tone: 'var(--vs-green)' } : { label: monitoring ? 'CONNECTING' : 'IDLE', tone: '#fff' };

  const motion = { ready: monitoring && vs.motion === 'ready' && !paused, energy: engine.motion.energy, contours: engine.motion.contours.length, ms: engine.motion.ms, state: !monitoring ? 'NO INPUT' : !opts.motion ? 'OFF' : vs.motion.toUpperCase() };
  const alerts = log.events.filter(e => e.level === 'warning' || e.level === 'critical').length;
  const counts = { V: Object.values(proc.records).filter(r => r.status === 'done').length, W: log.events.filter(e => e.level === 'warning').length, C: log.events.filter(e => e.level === 'critical').length, G: gestureCount, O: log.events.filter(e => e.kind === 'override').length };

  const host = be.host;
  const healthRows = [
    ['CAMERA', cam.state === 'active' ? 'LIVE · ' + Math.round(snap.fps) + ' FPS' : cam.state.toUpperCase(), cam.state === 'active' ? 'green' : ['denied', 'disconnected', 'error', 'no-camera'].includes(cam.state) ? 'red' : 'muted'],
    ['MICROPHONE', rec.state === 'listening' ? 'LISTENING' : rec.state === 'unavailable' ? 'UNAVAILABLE' : rec.state === 'denied' ? 'DENIED' : sys.permissions.microphone ? sys.permissions.microphone.toUpperCase() : 'IDLE', rec.state === 'listening' ? 'amber' : rec.state === 'denied' || rec.state === 'unavailable' ? 'red' : undefined],
    ['VISION', monitoring ? delegates + ' · ' + vision.label : 'OFF', monitoring && vision.label === 'LIVE' ? 'green' : undefined, visionLine],
    ['INFERENCE', monitoring ? Math.round(snap.inferenceMs) + ' MS' : '—'],
    ['NETWORK', (sys.online ? 'ONLINE' : 'OFFLINE') + (sys.connection && sys.connection.type ? ' · ' + sys.connection.type.toUpperCase() + (sys.connection.downlink != null ? ' ' + sys.connection.downlink + 'MB/S' : '') : ''), sys.online ? undefined : 'amber', 'navigator.onLine + navigator.connection (browser estimate)'],
    ['BACKEND WS', be.conn.toUpperCase(), be.conn === 'connected' ? 'green' : 'amber', backendUrl],
    ['JS HEAP', sys.heap ? Math.round(sys.heap.used) + ' / ' + Math.round(sys.heap.limit) + ' MB' : 'UNAVAILABLE', sys.heap ? undefined : 'muted'],
    ['BATTERY', sys.battery ? Math.round(sys.battery.level * 100) + '%' + (sys.battery.charging ? ' · CHG' : '') : 'UNAVAILABLE', sys.battery ? undefined : 'muted'],
    ['HOST CPU', host ? Math.round(host.cpu_percent) + '% · ' + Math.round(host.memory_percent) + '% MEM' : 'NEEDS BACKEND', host ? undefined : 'muted', host ? 'Backend machine ' + host.hostname : 'CPU/GPU load is only measured by the backend agent'],
    ['HOST TEMP', host ? (host.cpu_temp_c != null ? host.cpu_temp_c + ' °C' : 'NO SENSOR') : 'NEEDS BACKEND', 'muted'],
  ];

  const ticker = [...log.events.slice(0, 8).map(e => ({ t: timeOf(e.ts) + ' ' + e.title, tone: e.level === 'critical' ? 'red' : e.level === 'warning' || e.level === 'drift' ? 'amber' : e.level === 'verified' ? 'green' : undefined })),
    { t: 'CAMERA ' + (cam.state === 'active' ? 'LIVE' : cam.state.toUpperCase()) }, { t: 'SENSORS ' + be.label, tone: be.label.startsWith('LIVE') ? 'green' : be.label === 'SIMULATED FALLBACK' ? 'amber' : undefined },
    { t: 'OBJECTS ' + objInfo.label }, { t: 'MIC ' + rec.state.toUpperCase() }];
  const net = { online: sys.online, label: (sys.online ? 'ONLINE' : 'OFFLINE') + ' · ' + (be.conn === 'connected' ? 'BACKEND' : 'NO BACKEND'), tone: be.conn === 'connected' ? 'green' : 'amber', title: 'Backend: ' + backendUrl + ' (' + be.conn + ')' };
  const voice = { state: rec.state, interim: rec.interim, error: rec.error, handsFree: rec.handsFree, supported: rec.supported, tts: ttsSupported, out: voiceOut, alertsMuted, speaking, open: consoleOpen };

  const exportJSON = () => download('vistaspace-mission-log-' + new Date().toISOString().slice(0, 19).replace(/:/g, '') + '.json',
    JSON.stringify({ exported_at: new Date().toISOString(), procedure: { id: proc.def.id, title: proc.def.title, records: proc.records }, events: [...log.events].reverse() }, null, 2), 'application/json');
  const exportCSV = () => download('vistaspace-mission-log-' + new Date().toISOString().slice(0, 19).replace(/:/g, '') + '.csv', toCSV(log.events), 'text/csv');

  const left = { lang, proc, alerts, posture: snap.posture.level, poseOn: monitoring && opts.pose, elapsed: monStart ? clock.getTime() - monStart : null, live: monitoring,
    onOpen: setDrawer, motionSeries, motion, speed, hands: snap.hands, lastBySide, gestureCount, handsOn: monitoring && opts.hands, trailRef };
  const right = { lang, events: log.events, alert, onAck: ack, onOpen: setDrawer, live: monitoring, proc, confSeries, be, focus, healthRows, onFocus: () => {} };

  return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#000', overflow: 'hidden' }}>
    <div style={{ width: 1920 * scale, height: 1080 * scale }}>
      <div data-screen-label="Console" style={{ position: 'relative', width: 1920, height: 1080, transform: 'scale(' + scale + ')', transformOrigin: '0 0', background: 'var(--bg-grid), #000', display: 'grid', gridTemplateRows: '60px minmax(0,1fr) 34px', rowGap: 14, padding: '14px 20px', boxSizing: 'border-box', color: '#fff', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
        <TopBar lang={lang} setLang={setLang} net={net} fps={monitoring ? snap.fps : null} inference={monitoring ? snap.inferenceMs : null} vision={vision} clock={utcClock(clock)} ticker={ticker} />
        <div style={{ display: 'grid', gridTemplateColumns: '440px minmax(0,1fr) 440px', columnGap: 20, minHeight: 0 }}>
          <LeftColumn {...left} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <Monitor cam={cam} monitoring={monitoring} paused={paused} opts={opts} setOpt={setOpt} snap={snap} vision={visionLine}
              onStart={() => startMonitoring('manual')} onStop={() => stopMonitoring('manual')} onPause={() => togglePause('manual')}
              onCalibrate={() => run('calibrate', 'manual')} calibrated={calibrated} onSnapshot={() => capture('manual')}
              videoRef={cam.videoRef} canvasRef={canvasRef} alert={alert && !alert.acked ? alert : null} toast={toast} lang={lang}
              objInfo={objInfo} detections={snap.detections} lastGesture={lastGesture} selected={selected} motion={motion}>
              <VoiceConsole open={consoleOpen} onClose={() => { rec.stop(); setConsoleOpen(false); }} lang={lang} items={items} voice={voice}
                onSubmit={t => handleUtterance(t, null, 'typed')} onListen={() => { cancelSpeech(); rec.listen(lang); }} onHandsFree={() => rec.toggleHandsFree(lang)} />
            </Monitor>
            <Guidance proc={proc} lang={lang} rule={rule} voice={voice} onVoice={openVoice} onToggleVoiceOut={() => { setVoiceOut(v => { if (v) cancelSpeech(); return !v; }); }}
              onPrev={() => proc.prev('manual')} onComplete={() => completeStep('manual', null)} onNext={() => proc.next('manual')} />
          </div>
          <RightColumn {...right} />
        </div>
        <footer style={{ display: 'flex', alignItems: 'center', gap: 18, borderTop: '1px solid var(--border-divider)', paddingTop: 2 }}>
          <Legend gap={20} items={[{ code: 'V', label: 'Verified', color: 'var(--vs-green)', value: counts.V }, { code: 'W', label: 'Warnings', color: 'var(--vs-amber)', value: counts.W },
            { code: 'C', label: 'Critical', color: 'var(--vs-red)', value: counts.C }, { code: 'G', label: 'Gestures', color: '#fff', value: counts.G }, { code: 'O', label: 'Overrides', color: 'var(--vs-grey-500)', value: counts.O }]} />
          <span style={{ flex: 1 }}></span>
          <Chip tone={cam.state === 'active' ? 'red' : 'muted'} title="Camera">CAM {cam.state === 'active' ? '● LIVE' : 'OFF'}</Chip>
          <Chip tone={rec.state === 'listening' ? 'amber' : 'muted'} title="Microphone">MIC {rec.state === 'listening' ? '● ON' : rec.state === 'unavailable' ? 'N/A' : 'OFF'}</Chip>
          <Chip tone={be.label.startsWith('LIVE') ? 'green' : be.label === 'SIMULATED FALLBACK' ? 'amber' : 'muted'} title="Sensor data source">SENSORS {be.label}</Chip>
          <span style={{ flex: 1 }}></span>
          <Button size="sm" variant="secondary" icon="file-json" onClick={exportJSON}>Export JSON</Button>
          <Button size="sm" variant="secondary" icon="file" onClick={exportCSV}>Export CSV</Button>
          <Button size="sm" variant="ghost" icon="settings" onClick={() => setDrawer({ kind: 'settings' })}>Settings</Button>
        </footer>
        <Drawer open={!!drawer} width={560} onClose={() => setDrawer(null)}
          title={!drawer ? '' : drawer.kind === 'settings' ? 'Settings' : drawer.kind === 'log' ? 'Mission Log' : drawer.kind === 'step' ? 'Evidence · ' + drawer.id : 'Event · ' + drawer.event.title}
          subtitle={drawer && drawer.kind === 'settings' ? 'Tracking, gestures, voice and backend' : 'Recorded ' + (drawer && drawer.kind === 'log' ? log.events.length + ' events' : 'evidence')}
          footer={drawer && drawer.kind !== 'settings' ? <><Button variant="secondary" icon="file-json" onClick={exportJSON}>Export JSON</Button><Button variant="secondary" icon="file" onClick={exportCSV}>Export CSV</Button></> : null}>
          {drawer ? <DrawerBody d={drawer} proc={proc} log={log} onOpen={setDrawer} settings={{ pinchAction, setPinchAction, alertsMuted, setAlertsMuted, voiceOut, setVoiceOut, backendUrl, setBackendUrl, cam, opts, setOpt, calibrated, onClearCal: () => { engine.clearCalibration(); setCalibrated(false); } }} /> : null}
        </Drawer>
      </div>
    </div>
  </div>;
}

function Row({ k, v }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', padding: '7px 0', borderBottom: '1px solid var(--border-divider)' }}>
    <span style={{ font: '500 12px/1.3 var(--font-sans)', color: 'var(--text-muted)' }}>{k}</span><span style={{ font: '500 12px/1.4 var(--font-mono)', color: '#fff', wordBreak: 'break-word' }}>{v}</span></div>;
}

const field = { height: 30, padding: '0 8px', border: '1px solid var(--border-default)', background: '#000', color: '#fff', font: '400 13px/1 var(--font-sans)', borderRadius: 0, width: '100%' };

function DrawerBody({ d, proc, log, onOpen, settings: st }) {
  if (d.kind === 'step') {
    const step = proc.steps.find(s => s.id === d.id); const r = proc.records[d.id];
    if (!r) return <span>No record.</span>;
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatusBadge status={r.status === 'done' ? 'verified' : 'warning'} label={r.status === 'done' ? 'STEP VERIFIED' : 'STEP SKIPPED'} outline />
      <div style={{ font: '600 18px/1.3 var(--font-title)' }}>{step.id} · {step.title}</div>
      {r.evidence && r.evidence.snapshot ? <img src={r.evidence.snapshot} alt="" style={{ width: '100%', border: '1px solid var(--border-default)' }} /> : <div style={{ ...mono(11), color: 'var(--text-muted)' }}>No camera frame (monitoring was off).</div>}
      <div>{[['Completed', r.at], ['Method', r.method], ['Confidence', r.confidence != null ? r.confidence.toFixed(3) : 'n/a (manual)'], ['Step duration', (r.elapsedMs / 1000).toFixed(1) + ' s'],
        ['Rule', describeRule(step.auto)], ...Object.entries(r.details).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') || '—' : String(v)])].map(([k, v]) => <Row key={k} k={k} v={v} />)}</div>
    </div>;
  }
  if (d.kind === 'event') {
    const e = d.event; const snap = e.data && e.data.snapshot;
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {snap ? <img src={snap} alt="" style={{ width: '100%', border: '1px solid var(--border-default)' }} /> : null}
      <div>{[['Time', e.ts], ['Kind', e.kind], ['Level', e.level], ['Message', e.message]].map(([k, v]) => <Row key={k} k={k} v={v} />)}</div>
      <pre style={{ margin: 0, padding: 12, border: '1px solid var(--border-panel)', ...mono(11), lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{JSON.stringify(e.data, (k, v) => (typeof v === 'string' && v.startsWith('data:image') ? '[image]' : v), 2)}</pre>
    </div>;
  }
  if (d.kind === 'log') return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {log.events.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No events yet.</span> : null}
    {log.events.map(e => <button key={e.id} type="button" onClick={() => onOpen({ kind: 'event', event: e })} style={{ display: 'grid', gridTemplateColumns: '64px 90px 1fr', gap: 8, textAlign: 'left', padding: '6px 4px', background: 'none', border: 0, borderBottom: '1px solid var(--border-divider)', cursor: 'pointer', color: '#fff' }}>
      <span style={{ ...mono(11), color: 'var(--text-muted)' }}>{timeOf(e.ts)}</span>
      <span style={{ ...mono(11, 600), color: e.level === 'critical' ? 'var(--vs-red)' : e.level === 'warning' || e.level === 'drift' ? 'var(--vs-amber)' : e.level === 'verified' ? 'var(--vs-green)' : 'var(--text-secondary)' }}>{e.kind.toUpperCase()}</span>
      <span style={{ font: '500 12px/1.35 var(--font-sans)' }}>{e.title}<span style={{ color: 'var(--text-muted)' }}> · {e.message}</span></span>
    </button>)}
  </div>;
  // settings
  const T = POSTURE_THRESHOLDS;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ ...mono(11), color: 'var(--text-muted)' }}>PINCH GESTURE ACTION</span>
      <select id="set-pinch" value={st.pinchAction} onChange={e => st.setPinchAction(e.target.value)} style={field}>{Object.entries(PINCH_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ ...mono(11), color: 'var(--text-muted)' }}>CAMERA</span>
      <select id="set-camera" value={st.cam.info ? st.cam.info.deviceId : ''} onChange={e => st.cam.start(e.target.value)} disabled={!st.cam.devices.length} style={field}>
        {st.cam.devices.length ? st.cam.devices.map(dv => <option key={dv.deviceId} value={dv.deviceId}>{dv.label || 'Camera ' + dv.deviceId.slice(0, 6)}</option>) : <option>No cameras listed yet (grant permission first)</option>}</select></label>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip onClick={() => st.setVoiceOut(!st.voiceOut)} active={st.voiceOut} tone="white">VOICE OUTPUT {st.voiceOut ? 'ON' : 'OFF'}</Chip>
      <Chip onClick={() => st.setAlertsMuted(!st.alertsMuted)} active={!st.alertsMuted} tone="white">VOICE ALERTS {st.alertsMuted ? 'MUTED' : 'ON'}</Chip>
      <Chip onClick={() => st.setOpt('mirror', !st.opts.mirror)} active={st.opts.mirror} tone="white">MIRROR VIEW</Chip>
      <Chip onClick={st.onClearCal} tone={st.calibrated ? 'amber' : 'muted'}>{st.calibrated ? 'CLEAR CALIBRATION' : 'NOT CALIBRATED'}</Chip>
    </div>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ ...mono(11), color: 'var(--text-muted)' }}>BACKEND URL (FASTAPI)</span>
      <input id="set-backend" defaultValue={st.backendUrl} onBlur={e => st.setBackendUrl(e.target.value.trim() || DEFAULT_BACKEND)} style={field} /></label>
    <div>
      <div style={{ ...mono(11), color: 'var(--text-muted)', marginBottom: 6 }}>POSTURE THRESHOLDS (DEGREES) · src/live/posture.js</div>
      {['headTilt', 'neck', 'shoulderLevel', 'torsoLean', 'arm'].map(k => <Row key={k} k={T[k].label} v={'attention ≥ ' + T[k].attention + '° · critical ' + (T[k].critical != null ? '≥ ' + T[k].critical + '°' : '—')} />)}
      <Row k="Min visibility" v={T.minVisibility} /><Row k="Persistence" v={'attention ' + T.attentionHoldMs + ' ms · critical ' + T.criticalHoldMs + ' ms'} />
    </div>
    <div>
      <div style={{ ...mono(11), color: 'var(--text-muted)', marginBottom: 6 }}>GESTURES · src/live/gestures.js</div>
      {Object.entries(GESTURES).map(([k, g]) => <Row key={k} k={g.label} v={'hold ' + GESTURE_CONFIG.holdMs[k] + ' ms · min conf ' + GESTURE_CONFIG.minScore + ' · cooldown ' + GESTURE_CONFIG.cooldownMs + ' ms'} />)}
    </div>
    <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-muted)' }}>Posture and anomaly detection are a prototype aid only — not a medical, ergonomic, safety-certified or flight-certified system.</div>
  </div>;
}
