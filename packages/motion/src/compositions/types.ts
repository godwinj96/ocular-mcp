import type { AwarenessState } from '../systems/AwarenessTimeline.js';
import type { AttentionTarget } from '../systems/ObserverCamera.js';
import type { MotionEntry } from '../systems/MotionLedger.js';
import type { BoundaryClass } from '../primitives/BeatBoundary.js';
import type { ClaimReveal } from '../primitives/Claim.js';

// Sequence Architecture — Motion Design Bible §III.14. SequencePlan is the
// single input from which a composition renders (§IV.16 rule 3, the
// Data-Authoring Rule): a new video is authored by writing a plan, never by
// editing systems or primitives.

export type BeatClaim = {
  text: string;
  reveal: ClaimReveal;
  stagger?: 'accelerating';
};

export type BeatSpec = {
  id: string;
  /** Informative label — which Emotional Arc stage(s) this Beat expresses. */
  stage: string;
  /** Beat duration, in frames. Bounds: [T.scenic, 2 * T.monumental] (§III.14 rule 2). */
  frames: number;
  claim?: BeatClaim;
  /** If set, this Beat is where the AwarenessTimeline advances to this state (a Lucidity Step). */
  awarenessState?: AwarenessState;
  /** If set, this Beat is an Attention Traverse — the camera moves to this target. */
  attentionTarget?: Omit<AttentionTarget, 'arrivalFrame'>;
  /** Motion entries this Beat registers with the MotionLedger, frame-relative to the Beat's own start. */
  motionEntries?: {
    id: string;
    class: MotionEntry['class'];
    startFrame: number;
    endFrame: number;
  }[];
  boundaryOut: BoundaryClass;
  /** Scene content. Receives the Beat-relative frame (0 at the Beat's own start). */
  render: (beatRelativeFrame: number) => React.ReactNode;
};

export type SequencePlan = {
  id: string;
  width: number;
  height: number;
  fps?: number;
  loop?: boolean;
  beats: BeatSpec[];
};
