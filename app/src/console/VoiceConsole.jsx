import React, { useEffect, useRef, useState } from 'react';
import { Panel, Button, Icon } from '../ds';
import { AudioWave } from './Charts.jsx';
import { SUGGESTED } from '../live/commands.js';
import { MIC_TEXT } from './Guidance.jsx';
import { mono } from './ui.jsx';

/* Command console for VISTA. Every line here is either what the crew said/typed or the result of a command that ran. */
export function VoiceConsole({ open, onClose, lang, items, voice, onSubmit, onListen, onHandsFree }) {
  const [draft, setDraft] = useState('');
  const list = useRef(null); const input = useRef(null);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [items, voice.interim]);
  useEffect(() => { if (open && input.current) input.current.focus({ preventScroll: true }); }, [open]);
  if (!open) return null;
  const note = voice.state === 'unavailable' ? 'Speech recognition is not available in this browser (use Chrome or Edge). Typed commands work.'
    : voice.state === 'denied' ? 'Microphone permission denied. Allow the microphone for this site, or type commands.'
      : voice.error === 'no-response' ? 'Speech recognition did not start: this browser has no working speech service. Typed commands work.'
        : voice.error && voice.error !== 'no-speech' ? 'Speech recognition error: ' + voice.error + (voice.error === 'network' ? ' (recognition needs the browser’s online speech service)' : '') : null;
  const submit = e => { e.preventDefault(); if (draft.trim()) { onSubmit(draft.trim()); setDraft(''); } };
  return <div style={{ position: 'absolute', left: 14, bottom: 14, width: 560, height: 420, zIndex: 6, animation: 'vsRise .3s var(--ease-out)' }}>
    <Panel title={lang === 'hi' ? 'VISTA वॉइस कमांड' : 'VISTA Voice Commands'} subtitle={lang === 'hi' ? 'Voice commands' : 'वॉइस कमांड'} marker="AI" padding={0}
      style={{ height: '100%', background: 'rgba(5,5,5,.95)', backdropFilter: 'blur(6px)', borderColor: 'var(--border-strong)' }}
      right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ ...mono(11, 600), letterSpacing: '.1em', color: voice.state === 'listening' ? 'var(--vs-amber)' : 'var(--text-muted)' }}>{MIC_TEXT[voice.state] || voice.state.toUpperCase()}</span>
        <button type="button" aria-label="Close" onClick={onClose} style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', border: '1px solid var(--border-default)', background: 'transparent', color: '#fff', cursor: 'pointer', padding: 0 }}><Icon name="x" size={12} /></button>
      </span>}
      bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div ref={list} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 ? <span style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>
          Say or type a command. Commands run immediately: “Start monitoring”, “What is my posture status?”, “Mark step complete”, “Show temperature”… Say “help” for the full list.</span> : null}
        {items.map(it => <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: it.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <span style={{ ...mono(11), color: it.role === 'user' ? 'var(--text-muted)' : it.ok === false ? 'var(--vs-amber)' : 'var(--vs-green)' }}>
            {it.role === 'user' ? 'CREW · ' + it.via.toUpperCase() + (it.conf != null ? ' ' + it.conf.toFixed(2) : '') : it.cmd ? 'RAN · ' + it.cmd.toUpperCase() : 'NOT A COMMAND'} · {it.time}</span>
          <span style={{ maxWidth: '90%', padding: it.role === 'user' ? '6px 10px' : 0, border: it.role === 'user' ? '1px solid var(--border-default)' : 0,
            font: it.role === 'user' ? '400 13px/1.4 var(--font-sans)' : '500 14px/1.45 var(--font-sans)', color: it.role === 'user' ? 'var(--text-secondary)' : '#fff' }}>{it.text}</span>
        </div>)}
        {voice.state === 'listening' ? <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <AudioWave width={140} height={20} active color="#FF8A1F" />
          <span style={{ font: 'italic 400 13px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>{voice.interim || 'Listening…'}</span></div> : null}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 14px', borderTop: '1px solid var(--border-divider)' }}>
        {SUGGESTED.map(q => <button key={q} type="button" onClick={() => onSubmit(q)} style={{ height: 22, padding: '0 8px', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', font: '500 11px/1 var(--font-sans)', cursor: 'pointer' }}>{q}</button>)}
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto auto', gap: 6, padding: '10px 14px', borderTop: '1px solid var(--border-divider)' }}>
        <input id="vista-command" ref={input} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a command…" aria-label="Command"
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          style={{ height: 30, padding: '0 10px', border: '1px solid var(--border-default)', background: '#000', color: '#fff', font: '400 13px/1 var(--font-sans)', outline: 'none', borderRadius: 0, minWidth: 0 }} />
        <Button variant={voice.state === 'listening' && !voice.handsFree ? 'alert' : 'secondary'} icon="mic" onClick={onListen} disabled={!voice.supported} title="Push to talk">Talk</Button>
        <Button variant={voice.handsFree ? 'alert' : 'secondary'} icon="radio" onClick={onHandsFree} disabled={!voice.supported} title="Keep listening for commands">{voice.handsFree ? 'Hands-free on' : 'Hands-free'}</Button>
        <Button variant="primary" icon="send" onClick={submit} disabled={!draft.trim()}>Run</Button>
      </form>
      <div style={{ padding: '0 14px 10px', ...mono(11), color: note ? 'var(--vs-amber)' : 'var(--text-disabled)' }}>{note || 'Web Speech API · recognition ' + (voice.supported ? 'available' : 'unavailable') + ' · synthesis ' + (voice.tts ? 'available' : 'unavailable')}</div>
    </Panel>
  </div>;
}
