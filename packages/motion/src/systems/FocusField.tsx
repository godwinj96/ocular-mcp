import { useCurrentFrame } from 'remotion';
import { DurationToken, tokenInterpolate } from '../tokens/temporal.js';
import { FOCUS_BLUR_PX } from '../tokens/material.js';
import { useAwareness } from './AwarenessTimeline.js';

// Focus Field System — Motion Design Bible §II.9. [Draft] chapter: no
// canonical blur-radius scale or rack-focus timing has been ratified yet
// (Appendix D, Open Question 1). This is a minimal, clearly-provisional
// implementation so Resolution reveals and the Sigil Reveal's
// Catchlight-from-defocus have something principled to render with — see
// FOCUS_BLUR_PX's own doc comment in tokens/material.ts. Do not extend this
// module's defaults without flagging the same caveat; they are not settled
// canon.
//
// §II.9's one settled interaction rule this module *does* enforce: "L0-blind
// scenes have no focus differentiation — blindness has no certainty"
// (Reveal Grammar §II.10 rule 3: Resolution is prohibited at L0).

export type FocusPhase = 'sharp' | 'defocused';

// Rack-focus a value from defocused to sharp (or the reverse) over a
// duration token, using e-shift per Reveal Grammar's Resolution class
// (§II.10 rule 1). Returns a CSS blur radius in px.
export function useRackFocusBlur(
  startFrame: number,
  duration: DurationToken,
  direction: 'toSharp' | 'toDefocused' = 'toSharp',
  softness: keyof typeof FOCUS_BLUR_PX = 'softer',
): number {
  const frame = useCurrentFrame();
  const awareness = useAwareness();

  if (awareness.state === 'L0') {
    throw new Error(
      'useRackFocusBlur: Focus Field has no differentiation at L0-blind (§II.9 / §II.10 rule 3 — Resolution is ' +
        'prohibited at L0; blindness has no certainty).',
    );
  }

  const from = direction === 'toSharp' ? FOCUS_BLUR_PX[softness] : FOCUS_BLUR_PX.sharp;
  const to = direction === 'toSharp' ? FOCUS_BLUR_PX.sharp : FOCUS_BLUR_PX[softness];
  return tokenInterpolate(frame, startFrame, duration, from, to, 'shift');
}
