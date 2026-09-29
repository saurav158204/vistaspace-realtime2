import { useCallback, useRef, useState } from 'react';
import PROCEDURE from './procedure.json' with { type: 'json' };

/*
 * Procedure engine. Steps come from procedure.json. A step is completed by one of:
 *   manual   – the COMPLETE button          voice  – "mark step complete"
 *   gesture  – thumbs up (held, debounced)  auto   – the step's detection rule held for its duration
 * "Next step" skips (logged as a manual override); "Previous step" reopens the previous step (also logged).
 * Every completion stores an evidence record: method, time, elapsed, confidence, camera snapshot and detection context.
 */
export { PROCEDURE };

const now = () => Date.now();

function fresh() { return { index: 0, sessionStart: now(), stepStart: now(), records: {}, finishedAt: null }; }

export function useProcedure(log) {
  const ref = useRef(fresh());
  const [, force] = useState(0);
  const commit = s => { ref.current = s; force(x => x + 1); };
  const steps = PROCEDURE.steps;

  const complete = useCallback((method, info = {}) => {
    const s = ref.current; if (s.index >= steps.length) return null;
    const step = steps[s.index];
    const rec = { status: 'done', method, at: new Date().toISOString(), elapsedMs: now() - s.stepStart, confidence: info.confidence ?? null,
      evidence: info.evidence || null, details: info.details || {} };
    const index = s.index + 1;
    commit({ ...s, index, stepStart: now(), records: { ...s.records, [step.id]: rec }, finishedAt: index >= steps.length ? now() : null });
    log({ kind: 'procedure', level: 'verified', title: 'STEP VERIFIED', message: `${step.id} ${step.title} · ${method}` + (rec.confidence != null ? ` · conf ${rec.confidence.toFixed(2)}` : ''),
      data: { step: step.id, method, confidence: rec.confidence, elapsed_ms: rec.elapsedMs, details: rec.details, snapshot: rec.evidence && rec.evidence.snapshot } });
    if (index >= steps.length) log({ kind: 'procedure', level: 'verified', title: 'PROCEDURE COMPLETE', message: `${PROCEDURE.title} · ${steps.length}/${steps.length} steps` });
    return { step, rec };
  }, [steps]);

  const next = useCallback((by = 'manual') => {
    const s = ref.current; if (s.index >= steps.length) return null;
    const step = steps[s.index];
    const rec = { status: 'skipped', method: 'override', at: new Date().toISOString(), elapsedMs: now() - s.stepStart, confidence: null, evidence: null, details: { by } };
    commit({ ...s, index: s.index + 1, stepStart: now(), records: { ...s.records, [step.id]: rec }, finishedAt: s.index + 1 >= steps.length ? now() : null });
    log({ kind: 'override', level: 'warning', title: 'STEP SKIPPED', message: `${step.id} ${step.title} · manual override (${by})`, data: { step: step.id, by } });
    return step;
  }, [steps]);

  const prev = useCallback((by = 'manual') => {
    const s = ref.current; if (s.index === 0) return null;
    const step = steps[s.index - 1];
    const records = { ...s.records }; delete records[step.id];
    commit({ ...s, index: s.index - 1, stepStart: now(), records, finishedAt: null });
    log({ kind: 'override', level: 'warning', title: 'STEP REOPENED', message: `${step.id} ${step.title} · manual override (${by})`, data: { step: step.id, by } });
    return step;
  }, [steps]);

  const reset = useCallback(() => {
    commit(fresh());
    log({ kind: 'procedure', level: 'info', title: 'PROCEDURE RESET', message: PROCEDURE.title });
  }, []);

  const s = ref.current;
  return { def: PROCEDURE, steps, index: s.index, current: steps[s.index] || null, records: s.records, sessionStart: s.sessionStart, stepStart: s.stepStart,
    finishedAt: s.finishedAt, done: s.index >= steps.length, complete, next, prev, reset };
}

/*
 * Auto-completion rules, evaluated against live detections. Returns { ok, conf, blocked } for this instant.
 * `blocked` explains why a rule cannot run (e.g. object detection unavailable) — the step then needs a manual,
 * voice or gesture confirmation.
 */
export function evaluateRule(rule, ctx) {
  if (!rule) return { ok: false, conf: 0, blocked: null };
  if (!ctx.monitoring) return { ok: false, conf: 0, blocked: 'monitoring is off' };
  switch (rule.type) {
    case 'pose_visible': {
      const v = ctx.pose ? ctx.pose.metrics.visibility : 0;
      return ctx.poseEnabled ? { ok: v >= rule.minVisibility, conf: v } : { ok: false, conf: 0, blocked: 'pose tracking is off' };
    }
    case 'posture_nominal':
      return ctx.poseEnabled ? { ok: ctx.posture === 'nominal', conf: ctx.pose ? ctx.pose.metrics.visibility : 0 } : { ok: false, conf: 0, blocked: 'pose tracking is off' };
    case 'hands_visible': {
      if (!ctx.handsEnabled) return { ok: false, conf: 0, blocked: 'hand tracking is off' };
      const hs = ctx.hands || [];
      return { ok: hs.length >= rule.count, conf: hs.length ? hs.reduce((a, h) => a + h.handScore, 0) / hs.length : 0 };
    }
    case 'object_present': {
      if (!ctx.detectorAvailable) return { ok: false, conf: 0, blocked: 'object detection unavailable' };
      const hit = (ctx.detections || []).filter(d => d.label === rule.label && d.conf >= rule.minConf).sort((a, b) => b.conf - a.conf)[0];
      return { ok: !!hit, conf: hit ? hit.conf : 0 };
    }
    default:
      return { ok: false, conf: 0, blocked: 'unknown rule ' + rule.type };
  }
}

export function describeRule(rule) {
  if (!rule) return 'Confirm manually, by voice or with a thumbs up';
  switch (rule.type) {
    case 'pose_visible': return `Auto: body visible ≥ ${rule.minVisibility} for ${rule.seconds} s`;
    case 'posture_nominal': return `Auto: posture nominal for ${rule.seconds} s`;
    case 'hands_visible': return `Auto: ${rule.count} hands visible for ${rule.seconds} s`;
    case 'object_present': return `Auto: "${rule.label}" detected ≥ ${rule.minConf} for ${rule.seconds} s`;
    default: return rule.type;
  }
}
