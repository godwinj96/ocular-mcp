// @ocular/motion — public API. Motion Design Bible §IV.16: consumers author
// a SequencePlan and scene content; everything else (tokens, systems,
// primitives) is imported from here, never reimplemented per-project.

// Tokens
export {
  FPS,
  T,
  E,
  ANTICIPATION_LEAD_FRAMES,
  tokenInterpolate,
  easingCurve,
} from './tokens/temporal.js';
export type { DurationToken, EasingToken } from './tokens/temporal.js';
export {
  INK,
  WHITE,
  N,
  LOGOMARK,
  GAZE_RING,
  TYPE_ROLES,
  CLAIM_MAX_WORDS,
  CLAIM_MAX_LINES,
} from './tokens/brand.js';
export type { NeutralToken } from './tokens/brand.js';
export {
  RADIUS_PX,
  SHADOW_L2,
  TYPE_SIZE_PX,
  TYPE_LINE_HEIGHT,
  TYPE_TRACKING,
  FOCUS_BLUR_PX,
} from './tokens/material.js';
export { FORMATS } from './tokens/formats.js';
export type { FormatToken, FormatDescriptor } from './tokens/formats.js';
export {
  LOGO_VIEWBOX,
  LOGO_GROUP_TRANSFORM,
  LOGO_ICON_PATH,
  LOGO_LETTERS,
} from './tokens/logo-paths.js';
export type { LetterPath } from './tokens/logo-paths.js';
export { hexToOklch, oklchToHex, mixOklchHex } from './tokens/color.js';
export { loadPoppins } from './tokens/fonts.js';

// Systems
export { AwarenessTimeline, useAwareness } from './systems/AwarenessTimeline.js';
export type {
  AwarenessState,
  AwarenessEvent,
  AwarenessValue,
} from './systems/AwarenessTimeline.js';
export { ObserverCamera, useCamera } from './systems/ObserverCamera.js';
export type { AttentionTarget, CameraMove, CameraTransform } from './systems/ObserverCamera.js';
export { MOTION_COST, spendAtFrame, validateMotionLedger } from './systems/MotionLedger.js';
export type { MotionClass, MotionEntry, ValidateOptions } from './systems/MotionLedger.js';
export { useRackFocusBlur } from './systems/FocusField.js';
export type { FocusPhase } from './systems/FocusField.js';

// Primitives
export { Emergence } from './primitives/reveal/Emergence.js';
export type { EmergenceProps } from './primitives/reveal/Emergence.js';
export { Resolution } from './primitives/reveal/Resolution.js';
export { Assembly } from './primitives/reveal/Assembly.js';
export type { AssemblyPart, AssemblyProps } from './primitives/reveal/Assembly.js';
export { Disclosure } from './primitives/reveal/Disclosure.js';
export type { RevealProps } from './primitives/reveal/types.js';
export { Claim, AcceleratingStaggerScope, claimDwellFrames } from './primitives/Claim.js';
export type { ClaimProps, ClaimReveal } from './primitives/Claim.js';
export { GazeRing, GazeRingScope } from './primitives/GazeRing.js';
export type { GazeRingProps, Point } from './primitives/GazeRing.js';
export { SigilReveal, SIGIL_REVEAL_TOTAL_FRAMES } from './primitives/SigilReveal.js';
export type { SigilRevealProps } from './primitives/SigilReveal.js';
export { Surface } from './primitives/Surface.js';
export type { SurfaceProps } from './primitives/Surface.js';
export { boundaryOverlapFrames, validateBoundarySequence } from './primitives/BeatBoundary.js';
export type { BoundaryClass } from './primitives/BeatBoundary.js';

// Compositions
export { Beat } from './compositions/Beat.js';
export {
  SequenceRenderer,
  computeBeatStarts,
  sequencePlanTotalFrames,
  validatePlan,
} from './compositions/SequenceRenderer.js';
export type { SequencePlan, BeatSpec, BeatClaim } from './compositions/types.js';
