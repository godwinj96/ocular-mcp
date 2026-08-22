import { useCurrentFrame } from 'remotion';
import { Claim } from '../primitives/Claim.js';
import type { BeatSpec } from './types.js';

// A single Beat's rendered content: its scene (from the plan) plus, if
// declared, its one Claim (§III.14 rule 1 — a Beat contains at most one
// Claim).
//
// This renders inside a <TransitionSeries.Sequence>, and Remotion's own
// useCurrentFrame() is *already* relative to that Sequence's start (frame 0
// = the Beat's own first frame) — see remotion's use-current-frame.ts:
// `frame - (context.cumulatedFrom + context.relativeFrom)`. So there is no
// Beat-start offset to apply here; doing so would double-subtract. All
// entryFrame/atFrame values a scene passes to Emergence/Resolution/Claim/
// SigilReveal/GazeRing are therefore Beat-relative by construction, not
// absolute composition frames.
export function Beat({ spec }: { spec: BeatSpec }) {
  const frame = useCurrentFrame();

  return (
    <>
      {spec.render(frame)}
      {spec.claim ? (
        <Claim
          text={spec.claim.text}
          reveal={spec.claim.reveal}
          stagger={spec.claim.stagger}
          entryFrame={0}
        />
      ) : null}
    </>
  );
}
