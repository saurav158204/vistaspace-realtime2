import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Web Speech API wrappers.
 *   Speech synthesis   → speak()
 *   Speech recognition → useRecognition(): push-to-talk, or hands-free (continuous, auto-restarts)
 * Recognition states: unavailable | idle | listening | processing | denied | error
 * Note: Chrome/Edge implement recognition by streaming audio to the browser vendor's speech service, so it needs a
 * network connection; synthesis runs on the device.
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
export const ttsSupported = !!synth;
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const sttSupported = !!Recognition;

function pickVoice(lang) {
  if (!synth) return null;
  const voices = synth.getVoices();
  const want = lang === 'hi' ? ['hi-IN', 'hi'] : ['en-IN', 'en-GB', 'en-US', 'en'];
  for (const w of want) { const v = voices.find(x => x.lang && x.lang.replace('_', '-').toLowerCase().startsWith(w.toLowerCase())); if (v) return v; }
  return null;
}

export function speak(text, lang = 'en', { interrupt = false } = {}) {
  if (!synth || !text) return Promise.resolve(false);
  if (interrupt) synth.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const v = pickVoice(lang); if (v) u.voice = v;
    u.rate = 1.03;
    u.onend = () => resolve(true); u.onerror = () => resolve(false);
    synth.speak(u);
  });
}
export const cancelSpeech = () => synth && synth.cancel();

export function useSpeaking() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!synth) return undefined;
    synth.getVoices();
    const id = setInterval(() => setOn(synth.speaking || synth.pending), 200);
    return () => clearInterval(id);
  }, []);
  return on;
}

export function useRecognition(onFinal) {
  const [state, setState] = useState(sttSupported ? 'idle' : 'unavailable');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [handsFree, setHandsFree] = useState(false);
  const rec = useRef(null); const cb = useRef(onFinal); cb.current = onFinal;
  const hf = useRef(false); hf.current = handsFree;
  const langRef = useRef('en');

  const begin = useCallback((lang) => {
    if (!Recognition) { setState('unavailable'); return; }
    langRef.current = lang || langRef.current;
    if (rec.current) { try { rec.current.abort(); } catch { /* ignore */ } }
    const r = new Recognition();
    r.lang = langRef.current === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = true; r.maxAlternatives = 1; r.continuous = hf.current;
    let started = false;
    r.onstart = () => { started = true; setState('listening'); setError(null); setInterim(''); };
    r.onresult = e => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { const t = res[0].transcript.trim(); setInterim(''); if (t) { setState('processing'); cb.current(t, res[0].confidence, 'voice'); } }
        else live += res[0].transcript;
      }
      if (live) setInterim(live);
    };
    r.onerror = e => {
      const code = e.error || 'error';
      if (code === 'not-allowed' || code === 'service-not-allowed') { setState('denied'); setError(code); hf.current = false; setHandsFree(false); }
      else if (code !== 'no-speech' && code !== 'aborted') { setError(code); }
    };
    r.onend = () => {
      rec.current = null; setInterim('');
      setState(s => (s === 'denied' ? s : 'idle'));
      if (hf.current) setTimeout(() => { if (hf.current && !rec.current) begin(); }, 300);
    };
    rec.current = r;
    try { r.start(); } catch (err) { setError(String(err.message || err)); setState('error'); return; }
    // Some browsers expose the API but never start (no speech service). Report it instead of waiting silently.
    setTimeout(() => {
      if (!started && rec.current === r) {
        try { r.abort(); } catch { /* ignore */ }
        rec.current = null; hf.current = false; setHandsFree(false);
        setError('no-response'); setState('error');
      }
    }, 3000);
  }, []);

  const stop = useCallback(() => { hf.current = false; setHandsFree(false); if (rec.current) { try { rec.current.stop(); } catch { /* ignore */ } } }, []);
  const toggleHandsFree = useCallback((lang) => {
    if (hf.current) { stop(); return; }
    hf.current = true; setHandsFree(true); begin(lang);
  }, [begin, stop]);
  const done = useCallback(() => setState(s => (s === 'processing' ? (rec.current ? 'listening' : 'idle') : s)), []);

  useEffect(() => () => { hf.current = false; if (rec.current) { try { rec.current.abort(); } catch { /* ignore */ } } }, []);
  return { supported: sttSupported, state, interim, error, handsFree, listen: begin, stop, toggleHandsFree, done };
}
