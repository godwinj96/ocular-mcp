import { Easing, interpolate } from 'remotion';

// Canonical vocabulary of time — Motion Design Bible §II.6 (Temporal Grammar).
// Every duration and easing curve used anywhere in this package (and anything
// built on it) must come from this module. No other file may hand-roll a
// bezier or a raw millisecond/frame value on a hero or subordinate element —
// that is "token drift" (§II.6 anti-patterns) and it is the single most
// important invariant this package exists to enforce.

export const FPS = 30;

// §II.6 rule 2 — the canonical duration scale, in frames @30fps.
export const T = {
  micro: 4, // 133ms — opacity ticks, cursor states, micro-confirmations
  swift: 8, // 267ms — subordinate element entrances, focus shifts
  base: 16, // 533ms — standard element reveals, typographic entrances
  deliberate: 32, // 1067ms — primary reveals, camera attention shifts
  scenic: 64, // 2133ms — camera approaches, illumination transitions
  monumental: 128, // 4267ms — Discovery event, final dolly-out
} as const;

export type DurationToken = keyof typeof T;

// §II.6 rule 4 — Anticipation Lead: camera/lighting responses begin one lead
// before the narrative event they attend to. 200ms @30fps = 6 frames.
export const ANTICIPATION_LEAD_FRAMES = 6;

// §II.6 rule 5 — the canonical easing set. Cubic-bezier control points.
// No other curves are permitted on hero or subordinate elements.
export const E = {
  observe: [0.3, 0.0, 0.1, 1.0], // camera moves
  reveal: [0.2, 0.0, 0.0, 1.0], // element entrances, reveals
  exit: [0.6, 0.0, 0.9, 1.0], // element exits
  drift: [0.4, 0.0, 0.6, 1.0], // ambient motion only
  shift: [0.45, 0.0, 0.15, 1.0], // focus racks, lighting transitions
} as const;

export type EasingToken = keyof typeof E;

function bezierEasing(token: EasingToken) {
  const [x1, y1, x2, y2] = E[token];
  return Easing.bezier(x1, y1, x2, y2);
}

// The only sanctioned interpolation entry point (§IV.16 rule 4). Accepts
// tokens, never raw frame/ms numbers, so a duration can never silently drift
// off the canonical scale.
export function tokenInterpolate(
  frame: number,
  start: number,
  duration: DurationToken,
  from: number,
  to: number,
  ease: EasingToken,
): number {
  return interpolate(frame, [start, start + T[duration]], [from, to], {
    easing: bezierEasing(ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function easingCurve(ease: EasingToken) {
  return bezierEasing(ease);
}
