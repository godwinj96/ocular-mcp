import { Fragment, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming, TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { T, FPS as DEFAULT_FPS } from '../tokens/temporal.js';
import { AwarenessTimeline, AwarenessEvent } from '../systems/AwarenessTimeline.js';
import { ObserverCamera, AttentionTarget } from '../systems/ObserverCamera.js';
import { validateMotionLedger, MotionEntry } from '../systems/MotionLedger.js';
import {
  boundaryOverlapFrames,
  validateBoundarySequence,
  BoundaryClass,
} from '../primitives/BeatBoundary.js';
import { GazeRingScope } from '../primitives/GazeRing.js';
import { AcceleratingStaggerScope } from '../primitives/Claim.js';
import { Beat } from './Beat.js';
import type { SequencePlan } from './types.js';

// SequenceRenderer — Motion Design Bible §IV.16 rule 14. The only
// composition entry point. Validates the entire plan before rendering
// (§III.14/§I.5/§II.11/§II.8 rules) and fails loudly with the violated
// rule's canon reference, mirroring the bible's own stated error format.

// §II.11 rule 4 — boundary-class-to-presentation mapping: Field Handoff is
// the structural default (elements exit/reveal, field persists); Attention
// Traverse carries the frame between spatial zones (rendered as a
// directional slide, since this package's camera is a 2D transform, not a
// literal 3D dolly); Lucidity Step is an awareness-state transition, best
// read as a fade since the field itself is what's changing.
function boundaryPresentation(
  boundaryClass: BoundaryClass,
): TransitionPresentation<Record<string, unknown>> {
  switch (boundaryClass) {
    case 'FieldHandoff':
      return fade();
    case 'AttentionTraverse':
      return slide({ direction: 'from-right' });
    case 'LucidityStep':
      return fade();
  }
}

export function computeBeatStarts(plan: SequencePlan): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (let i = 0; i < plan.beats.length; i++) {
    starts.push(cursor);
    const beat = plan.beats[i]!;
    const overlap = i < plan.beats.length - 1 ? boundaryOverlapFrames(beat.boundaryOut) : 0;
    cursor += beat.frames - overlap;
  }
  return starts;
}

export function sequencePlanTotalFrames(plan: SequencePlan): number {
  const starts = computeBeatStarts(plan);
  const lastIndex = plan.beats.length - 1;
  const lastBeat = plan.beats[lastIndex];
  if (!lastBeat) return 0;
  return starts[lastIndex]! + lastBeat.frames;
}

export function validatePlan(plan: SequencePlan, starts: number[], total: number): void {
  if (process.env.NODE_ENV === 'production') return;
  const fps = plan.fps ?? DEFAULT_FPS;

  // §III.14 rule 2 — Beat duration bounds.
  plan.beats.forEach((beat) => {
    if (beat.frames < T.scenic || beat.frames > 2 * T.monumental) {
      throw new Error(
        `SequenceRenderer: Beat "${beat.id}" is ${beat.frames}f, outside the [${T.scenic}, ${2 * T.monumental}] ` +
          `bound (§III.14 rule 2).`,
      );
    }
  });

  // §III.14 rule 8 — boundary sequencing.
  validateBoundarySequence(plan.beats.map((b) => b.boundaryOut));

  // §III.14 rule 5 — Discovery placement at 45-55%, post-Discovery time >= 40%.
  const discoveryIndex = plan.beats.findIndex(
    (b, i) => b.awarenessState === 'L2' && plan.beats[i - 1]?.awarenessState !== 'L2',
  );
  if (discoveryIndex >= 0) {
    const discoveryFrame = starts[discoveryIndex]!;
    const pct = discoveryFrame / total;
    if (pct < 0.45 || pct > 0.55) {
      throw new Error(
        `SequenceRenderer: Discovery event sits at ${(pct * 100).toFixed(1)}% of duration, outside 45-55% ` +
          `(§III.14 rule 5).`,
      );
    }
    const postDiscoveryFrac = (total - discoveryFrame) / total;
    if (postDiscoveryFrac < 0.4) {
      throw new Error(
        `SequenceRenderer: post-Discovery time is ${(postDiscoveryFrac * 100).toFixed(1)}% of total, < 40% ` +
          `(§III.14 rule 5).`,
      );
    }
  }

  // §III.14 rule 6 — final Beat terminates in >= 2s of stillness. Proxy
  // check: no registered motion entry in the final Beat may end within the
  // last 2s of that Beat.
  const lastBeat = plan.beats[plan.beats.length - 1];
  if (lastBeat) {
    const minStillFrames = fps * 2;
    const stillnessFloor = lastBeat.frames - minStillFrames;
    const lateMotion = (lastBeat.motionEntries ?? []).find(
      (entry) => entry.endFrame > stillnessFloor,
    );
    if (lateMotion) {
      throw new Error(
        `SequenceRenderer: final Beat "${lastBeat.id}" has motion ("${lateMotion.id}") ending at frame ` +
          `${lateMotion.endFrame}, inside the required final ${minStillFrames}f (2s) of stillness (§III.14 rule 6).`,
      );
    }
  }

  // §II.11 rules 7-8 — Loop Closure, structural proxy (not a pixel diff —
  // see this package's README for why a true frame-0-vs-final-frame render
  // comparison is a Future Extension Point, not implemented here).
  if (plan.loop) {
    const first = plan.beats[0];
    const last = plan.beats[plan.beats.length - 1];
    if (first?.awarenessState !== 'L3' || last?.awarenessState !== 'L3') {
      throw new Error(
        `SequenceRenderer: plan.loop is true but the first/last Beat aren't both declared awarenessState "L3" ` +
          `(§II.11 rule 8 — Field parity: a looping composition opens and closes at L3-lucid).`,
      );
    }
  }

  // §I.5 — Motion Budget, via MotionLedger.
  const entries: MotionEntry[] = plan.beats.flatMap((beat, i) =>
    (beat.motionEntries ?? []).map((entry) => ({
      id: `${beat.id}:${entry.id}`,
      class: entry.class,
      startFrame: starts[i]! + entry.startFrame,
      endFrame: starts[i]! + entry.endFrame,
    })),
  );
  // §I.5 rule 5's cap is scoped to the Clarity/Conviction *stage*, not a
  // literal pixel range — but adjacent Beats visually crossfade for
  // boundaryOverlapFrames() on each side (§II.11), so a Beat's raw
  // [start, start+frames) window double-counts the transition it shares
  // with its neighbors. Trim both ends by the adjacent boundary overlap so
  // the strict cap only applies to this Beat's own settled, non-crossfading
  // core — otherwise a neighboring Beat's legitimate onset motion, still
  // mid-crossfade into view, gets misattributed to this Beat's stricter cap.
  const clarityConvictionRanges: [number, number][] = plan.beats
    .map((beat, i) => {
      if (!beat.stage.includes('Clarity') && !beat.stage.includes('Conviction')) return null;
      const leadingTrim = i > 0 ? boundaryOverlapFrames(plan.beats[i - 1]!.boundaryOut) : 0;
      const trailingTrim = i < plan.beats.length - 1 ? boundaryOverlapFrames(beat.boundaryOut) : 0;
      const rangeStart = starts[i]! + leadingTrim;
      const rangeEnd = starts[i]! + beat.frames - trailingTrim;
      return rangeEnd > rangeStart ? ([rangeStart, rangeEnd] as [number, number]) : null;
    })
    .filter((r): r is [number, number] => r !== null);
  validateMotionLedger(entries, { totalFrames: total, clarityConvictionRanges });
}

export function SequenceRenderer({ plan }: { plan: SequencePlan }) {
  const starts = useMemo(() => computeBeatStarts(plan), [plan]);
  const total = useMemo(() => sequencePlanTotalFrames(plan), [plan]);

  useMemo(() => validatePlan(plan, starts, total), [plan, starts, total]);

  const awarenessEvents = useMemo<AwarenessEvent[]>(
    () =>
      plan.beats
        .map((b, i) => (b.awarenessState ? { state: b.awarenessState, atFrame: starts[i]! } : null))
        .filter((e): e is AwarenessEvent => e !== null),
    [plan, starts],
  );

  const attentionTargets = useMemo<AttentionTarget[]>(
    () =>
      plan.beats
        .map((b, i) =>
          b.attentionTarget ? { ...b.attentionTarget, arrivalFrame: starts[i]! } : null,
        )
        .filter((t): t is AttentionTarget => t !== null),
    [plan, starts],
  );

  return (
    <AbsoluteFill style={{ width: plan.width, height: plan.height }}>
      <AwarenessTimeline events={awarenessEvents}>
        <ObserverCamera targets={attentionTargets}>
          <GazeRingScope>
            <AcceleratingStaggerScope>
              <TransitionSeries>
                {plan.beats.map((beat, i) => (
                  <Fragment key={beat.id}>
                    <TransitionSeries.Sequence durationInFrames={beat.frames}>
                      <Beat spec={beat} />
                    </TransitionSeries.Sequence>
                    {i < plan.beats.length - 1 ? (
                      <TransitionSeries.Transition
                        presentation={boundaryPresentation(beat.boundaryOut)}
                        timing={linearTiming({
                          durationInFrames: boundaryOverlapFrames(beat.boundaryOut),
                        })}
                      />
                    ) : null}
                  </Fragment>
                ))}
              </TransitionSeries>
            </AcceleratingStaggerScope>
          </GazeRingScope>
        </ObserverCamera>
      </AwarenessTimeline>
    </AbsoluteFill>
  );
}
