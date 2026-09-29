import { useCallback, useRef, useState } from 'react';

/*
 * Mission log: every gesture, posture change, procedure progression, override, voice command and source change.
 * Event: { id, ts (ISO 8601), kind, level: info|verified|warning|critical|drift, title, message, data }
 * Events are mirrored to the backend (SQLite) when it is connected; export works either way.
 */
let seq = 0;
export const newId = () => Date.now().toString(36) + '-' + (++seq).toString(36);

export function useMissionLog(onEvent) {
  const [events, setEvents] = useState([]);
  const cb = useRef(onEvent); cb.current = onEvent;
  const add = useCallback((e) => {
    const ev = { id: newId(), ts: new Date().toISOString(), level: 'info', message: '', data: {}, ...e };
    setEvents(list => [ev, ...list].slice(0, 2000));
    if (cb.current) cb.current(ev);
    return ev;
  }, []);
  return { events, add };
}

export const timeOf = iso => new Date(iso).toISOString().slice(11, 19);

const csvCell = v => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export function toCSV(events) {
  const rows = [['id', 'ts', 'kind', 'level', 'title', 'message', 'data']];
  for (const e of [...events].reverse()) rows.push([e.id, e.ts, e.kind, e.level, e.title, e.message, stripImages(e.data)]);
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

// Evidence snapshots are large data URLs; keep them in JSON exports, drop them from CSV.
function stripImages(d) {
  if (!d || typeof d !== 'object') return d;
  const o = Array.isArray(d) ? [] : {};
  for (const k in d) o[k] = typeof d[k] === 'string' && d[k].startsWith('data:image') ? '[image]' : (typeof d[k] === 'object' ? stripImages(d[k]) : d[k]);
  return o;
}

export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
