import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Webcam lifecycle. States:
 *   idle | requesting | active | denied | no-camera | in-use | disconnected | unsupported | insecure | error
 * The stream is only opened by an explicit user action (start) and every track is stopped on stop/unmount.
 */
export const CAMERA_TEXT = {
  idle: 'Camera off',
  requesting: 'Waiting for camera permission…',
  active: 'Camera live',
  denied: 'Camera permission denied. Allow camera access for this site in the browser settings, then start again.',
  'no-camera': 'No camera found. Connect a webcam and start again.',
  'in-use': 'The camera is in use by another application or could not be started.',
  disconnected: 'The camera was disconnected. Reconnect it and start again.',
  unsupported: 'This browser does not support camera capture (navigator.mediaDevices.getUserMedia).',
  insecure: 'Camera access needs a secure page: open the console on https:// or http://localhost.',
  error: 'The camera could not be started.',
};

function classify(err) {
  switch (err && err.name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'DevicesNotFoundError': case 'OverconstrainedError': return 'no-camera';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return 'in-use';
    default: return 'error';
  }
}

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState(() => (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia
    ? (typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'unsupported') : 'idle'));
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [info, setInfo] = useState(null); // {label, width, height, frameRate, deviceId}

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')); } catch { /* ignore */ }
  }, []);

  const release = useCallback(() => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach(t => { t.onended = null; t.stop(); });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setInfo(null);
  }, []);

  const stop = useCallback(() => { release(); setState(s => (s === 'unsupported' || s === 'insecure' ? s : 'idle')); setError(null); }, [release]);

  const start = useCallback(async (deviceId) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { const st = window.isSecureContext ? 'unsupported' : 'insecure'; setState(st); return st; }
    release();
    setState('requesting'); setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.onended = () => { release(); setState('disconnected'); };
      const v = videoRef.current;
      if (v) { v.srcObject = stream; v.muted = true; v.playsInline = true; await v.play().catch(() => {}); }
      const st = track.getSettings ? track.getSettings() : {};
      setInfo({ label: track.label || 'Camera', width: st.width, height: st.height, frameRate: st.frameRate, deviceId: st.deviceId });
      setState('active');
      refreshDevices();
      return 'active';
    } catch (e) {
      release();
      const st = classify(e);
      setState(st); setError(e && (e.message || e.name));
      return st;
    }
  }, [release, refreshDevices]);

  useEffect(() => {
    refreshDevices();
    const md = navigator.mediaDevices;
    if (!md || !md.addEventListener) return undefined;
    const onChange = () => refreshDevices();
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, [refreshDevices]);

  useEffect(() => release, [release]);

  return { videoRef, state, error, info, devices, start, stop, text: CAMERA_TEXT[state] };
}
