import React from 'react';
import { Panel, Icon, Button } from '../ds';
import { AudioWave } from './Charts.jsx';
import { describeRule } from '../live/procedure.js';
import { mono } from './ui.jsx';

export const MIC_TEXT = { unavailable: 'MIC UNAVAILABLE', idle: 'READY', listening: 'LISTENING', processing: 'PROCESSING', denied: 'MIC DENIED', error: 'MIC ERROR' };

export function Guidance({ proc, lang, rule, voice, onVoice, onToggleVoiceOut, onPrev, onComplete, onNext }) {
  const step = proc.current;
  const done = proc.done;
  const first = done ? (lang === 'hi' ? 'प्रक्रिया पूर्ण' : 'Procedure complete') : lang === 'hi' ? step.instructionHi : step.instruction;
  const second = done ? (lang === 'hi' ? 'Procedure complete' : 'प्रक्रिया पूर्ण') : lang === 'hi' ? step.instruction : step.instructionHi;
  const listening = voice.state === 'listening';
  const micLabel = !voice.out && voice.state === 'idle' ? 'MUTED' : MIC_TEXT[voice.state] || voice.state.toUpperCase();
  const micTone = listening ? 'var(--vs-amber)' : voice.state === 'processing' ? '#fff' : ['unavailable', 'denied', 'error'].includes(voice.state) ? 'var(--vs-red)' : 'var(--text-muted)';
  let ruleText = describeRule(step && step.auto);
  if (rule && rule.blocked && step && step.auto) ruleText += ' — ' + rule.blocked + '; confirm manually';
  const ruleTone = rule && rule.blocked ? 'var(--vs-amber)' : 'var(--text-muted)';

  return <Panel padding="0 20px" style={{ flex: 1 }} bodyStyle={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 230px', gap: 18, alignItems: 'center' }}>
    <div style={{ width: 76, height: 76, border: '1px solid ' + (done ? 'var(--vs-green)' : '#fff'), color: done ? 'var(--vs-green)' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative' }}>
      <Icon name={done ? 'check' : 'arrow-right'} size={20} /><span style={{ ...mono(11, 600), letterSpacing: '.14em' }}>{done ? 'DONE' : step.id}</span>
      {!done && rule && rule.hold > 0 ? <span style={{ position: 'absolute', left: -1, bottom: -1, height: 3, width: (rule.hold * 100) + '%', background: 'var(--vs-green)' }}></span> : null}
    </div>
    <div style={{ minWidth: 0 }}>
      <div key={(step ? step.id : 'done') + lang} style={{ font: '600 22px/1.15 var(--font-title)', letterSpacing: '-.015em', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'vsRise .45s var(--ease-out)' }}>
        {!done ? <span style={{ fontWeight: 300, color: 'var(--text-secondary)', marginRight: 10 }}>{lang === 'hi' ? 'अब:' : 'NOW:'}</span> : null}{first}</div>
      <div style={{ font: '400 15px/1.3 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{second}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
        <Button size="sm" variant="ghost" icon="chevron-left" onClick={onPrev} disabled={proc.index === 0} title="Previous step (reopens it, logged as override)">Prev</Button>
        <Button size="sm" variant="primary" icon="check" onClick={onComplete} disabled={done} title="Mark the current step complete (manual)">Complete</Button>
        <Button size="sm" variant="secondary" icon="chevron-right" onClick={onNext} disabled={done} title="Skip to the next step (logged as override)">Next</Button>
        <span style={{ ...mono(11), color: ruleTone, marginLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{done ? 'All steps recorded in the mission log' : ruleText}</span>
      </div>
    </div>
    <div role="button" tabIndex={0} title="Talk to VISTA (V)" onClick={onVoice} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVoice(); } }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', padding: '6px 8px', margin: '-6px -8px', background: voice.open ? 'var(--surface-hover)' : 'transparent' }}>
      <AudioWave width={230} height={40} active={listening || voice.speaking} color={listening ? '#FF8A1F' : '#fff'} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...mono(11), color: 'var(--text-muted)', letterSpacing: '.08em' }}>
        <button type="button" title={voice.out ? 'Mute all voice output' : 'Unmute voice output'} onClick={e => { e.stopPropagation(); onToggleVoiceOut(); }}
          style={{ display: 'inline-flex', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: voice.out ? '#fff' : 'var(--text-muted)' }}><Icon name={voice.out ? 'volume-2' : 'volume-x'} size={13} /></button>
        <span style={{ whiteSpace: 'nowrap' }}>VOICE · {voice.alertsMuted ? 'ALERTS MUTED' : 'EN + हिं'}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: micTone }}><Icon name={voice.state === 'unavailable' || voice.state === 'denied' ? 'mic-off' : 'mic'} size={12} />{voice.handsFree && voice.state === 'listening' ? 'HANDS-FREE' : micLabel}</span>
      </div>
    </div>
  </Panel>;
}
