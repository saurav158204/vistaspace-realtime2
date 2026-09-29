import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Connection to the FastAPI backend (backend/). Nothing here is simulated in the browser: when the backend is not
 * reachable the sensor source is DISCONNECTED and no values are shown. SIMULATED FALLBACK only appears when the
 * backend itself is generating clearly-labelled simulated readings (VISTA_SIM_FALLBACK=true).
 */
export const DEFAULT_BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
const wsUrl = (base, path) => base.replace(/^http/, 'ws').replace(/\/$/, '') + path;

export const SOURCE_TONE = { 'LIVE HARDWARE': 'green', 'LIVE API': 'green', 'SIMULATED FALLBACK': 'amber', DISCONNECTED: 'muted' };

export function useBackend(base) {
  const [conn, setConn] = useState('connecting');   // connecting | connected | disconnected
  const [status, setStatus] = useState(null);       // last {"type":"status"} message
  const [latest, setLatest] = useState(null);       // last telemetry message (any source)
  const [series, setSeries] = useState([]);         // [{t, source, ambient, device, humidity}]
  const [lastError, setLastError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let closed = false, timer = null, backoff = 1000;
    const connect = () => {
      setConn('connecting');
      let ws;
      try { ws = new WebSocket(wsUrl(base, '/ws/telemetry')); } catch (e) { setLastError(String(e)); setConn('disconnected'); return; }
      wsRef.current = ws;
      ws.onopen = () => { backoff = 1000; setConn('connected'); setLastError(null); };
      ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.type === 'status') setStatus(m);
        else if (m.type === 'telemetry') {
          setLatest(m);
          setSeries(s => [...s.slice(-179), { t: Date.parse(m.received_at), source: m.source, ambient: m.reading.ambient_temp_c, device: m.reading.device_temp_c, humidity: m.reading.humidity_pct }]);
        } else if (m.type === 'hello') {
          setSeries((m.history || []).map(h => ({ t: Date.parse(h.received_at), source: h.source, ambient: h.reading.ambient_temp_c, device: h.reading.device_temp_c, humidity: h.reading.humidity_pct })).slice(-180));
        }
      };
      ws.onerror = () => setLastError('WebSocket error');
      ws.onclose = () => {
        wsRef.current = null;
        if (closed) return;
        setConn('disconnected'); setStatus(null);
        timer = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 10000);
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); if (wsRef.current) wsRef.current.close(); };
  }, [base]);

  const postEvent = useCallback(ev => {
    if (conn !== 'connected') return;
    fetch(base.replace(/\/$/, '') + '/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) }).catch(() => {});
  }, [base, conn]);

  const sensors = status && status.sensors;
  const label = conn !== 'connected' ? 'DISCONNECTED' : sensors ? sensors.active_label : 'DISCONNECTED';
  // Show the latest reading only if it comes from the currently active source.
  const reading = latest && sensors && latest.source === sensors.active_source ? latest : null;
  return { conn, status, label, reading, series, host: status && status.host, detector: status && status.detector, sensors, lastError, postEvent };
}

/*
 * Streams camera frames to the backend YOLO detector (/ws/detect) while enabled. One frame in flight at a time,
 * capped at `maxFps`. Results go straight into the vision engine so they are drawn on the live video.
 */
export function useBackendDetector(base, engineRef, enabled, maxFps = 4) {
  const [info, setInfo] = useState({ state: 'off' }); // off | connecting | ready | unavailable | disconnected
  useEffect(() => {
    if (!enabled) { setInfo({ state: 'off' }); return undefined; }
    let ws, stopped = false, timer = null;
    setInfo({ state: 'connecting' });
    const pump = async () => {
      if (stopped || !ws || ws.readyState !== 1) return;
      const t0 = performance.now();
      const blob = engineRef.current && await engineRef.current.grabJpeg(640);
      if (!blob || stopped || ws.readyState !== 1) { timer = setTimeout(pump, 500); return; }
      ws._t0 = t0; ws.send(await blob.arrayBuffer());
    };
    try { ws = new WebSocket(wsUrl(base, '/ws/detect')); } catch { setInfo({ state: 'disconnected' }); return undefined; }
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'detector') {
        if (m.available) { setInfo({ state: 'ready', model: m.name }); pump(); }
        else setInfo({ state: 'unavailable', reason: m.reason });
        return;
      }
      if (m.type === 'detections') {
        if (m.available === false) { setInfo({ state: 'unavailable', reason: m.reason }); return; }
        if (engineRef.current) engineRef.current.backendDetections = { at: performance.now(), list: m.detections };
        const rtt = performance.now() - (ws._t0 || performance.now());
        setInfo({ state: 'ready', model: m.model, inferenceMs: m.inference_ms, rttMs: rtt, count: m.detections.length });
        timer = setTimeout(pump, Math.max(0, 1000 / maxFps - rtt));
      }
    };
    ws.onclose = () => { if (!stopped) setInfo({ state: 'disconnected' }); };
    return () => { stopped = true; clearTimeout(timer); ws.close(); if (engineRef.current) engineRef.current.backendDetections = { at: 0, list: [] }; };
  }, [base, enabled, maxFps, engineRef]);
  return info;
}
