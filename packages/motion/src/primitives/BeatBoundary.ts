import { T } from '../tokens/temporal.js';

// Transition Grammar — Motion Design Bible §II.11. The closed set of three
// boundary classes governing movement between Beats. This module is data +
// validation; the actual transition rendering (Remotion's
// TransitionSeries.Transition) lives in compositions/SequenceRenderer.tsx,
// since Beat sequencing needs the whole plan in view.

export type BoundaryClass = 'FieldHandoff' | 'AttentionTraverse' | 'LucidityStep';

// §II.11 rule 6 — boundaries must complete within t-deliberate for Field
// Handoffs and t-scenic for Attention Traverses. Lucidity Steps are bound
// to the Awareness Lighting transition duration instead (t-scenic, or
// t-monumental for the Discovery step) — handled by AwarenessTimeline, not
// here.
export function boundaryOverlapFrames(boundaryClass: BoundaryClass): number {
  switch (boundaryClass) {
    case 'FieldHandoff':
      return T.deliberate;
    case 'AttentionTraverse':
      return T.scenic;
    case 'LucidityStep':
      return T.scenic;
  }
}

// §III.14 rule 8 — an Attention Traverse may not directly follow an
// Attention Traverse (perpetual travel reads as tourism).
export function validateBoundarySequence(boundaryClasses: BoundaryClass[]): void {
  for (let i = 1; i < boundaryClasses.length; i++) {
    if (
      boundaryClasses[i] === 'AttentionTraverse' &&
      boundaryClasses[i - 1] === 'AttentionTraverse'
    ) {
      throw new Error(
        `BeatBoundary: two consecutive AttentionTraverse boundaries at index ${i - 1}-${i} (§III.14 rule 8 — ` +
          `an Attention Traverse may not directly follow an Attention Traverse).`,
      );
    }
  }
}
