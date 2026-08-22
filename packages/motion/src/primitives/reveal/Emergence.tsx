import { useCurrentFrame } from 'remotion';
import { tokenInterpolate } from '../../tokens/temporal.js';
import type { RevealProps } from './types.js';

// Reveal Grammar — Emergence class (§II.10 rule 1). "Something existed but
// was unperceived; awareness reaches it." Opacity/luminance ramp, <= 4%
// positional travel, e-reveal. Requires an active illumination context (L1+
// — §II.10 rule 3); this primitive doesn't itself read AwarenessTimeline
// since it has no opinion on *which* state, only that lighting must already
// be non-blind — callers are responsible for not mounting Emergence inside
// an L0 scene.

export type EmergenceProps = RevealProps & {
  // Fraction of the travel distance, expressed directly in px by the
  // caller (this primitive doesn't know the container's own size) — kept
  // small per the <=4% positional-travel ceiling.
  travelPx?: number;
  direction?: 'up' | 'down';
};

export function Emergence({
  entryFrame,
  duration,
  travelPx = 12,
  direction = 'up',
  children,
}: EmergenceProps) {
  const frame = useCurrentFrame();
  const opacity = tokenInterpolate(frame, entryFrame, duration, 0, 1, 'reveal');
  const travel = tokenInterpolate(
    frame,
    entryFrame,
    duration,
    direction === 'up' ? travelPx : -travelPx,
    0,
    'reveal',
  );

  return <div style={{ opacity, transform: `translateY(${travel}px)` }}>{children}</div>;
}
