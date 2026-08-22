import { useCurrentFrame } from 'remotion';
import { tokenInterpolate, DurationToken } from '../tokens/temporal.js';
import { GAZE_RING, N } from '../tokens/brand.js';
import { useAwareness } from '../systems/AwarenessTimeline.js';

// Gaze Ring — Motion Design Bible §I.6 rules 10-14, §IV.15 rule 8,
// §IV.16 rule 11. The visible indicator of machine attention; Ocular's
// perception made observable inside Idealized UI. Exists only at L1-aware
// and above (rule 13) — its absence at L0 *is* the depiction of blindness,
// so this component refuses to render below L1 rather than rendering a
// disabled/greyed state.
//
// Rule 14's "at most one active" ceiling is deliberately NOT enforced by a
// mount-time singleton here (an earlier version tried a claim-on-mount
// React context ref and it was wrong): Remotion's TransitionSeries mounts
// the outgoing and incoming Beat simultaneously for the whole crossfade
// duration — that's how a crossfade renders at all — so two GazeRings in
// adjacent Beats both legitimately mount at once even though only one is
// meant to read as "in view" at a given moment. A correct check needs the
// full SequencePlan's declared per-Beat GazeRing usage (like
// SequenceRenderer's other validators), not something the component itself
// can see. Checking it there is a documented Future Extension Point;
// GazeRingScope is kept as a no-op wrapper for that future API to attach
// to without changing every call site again.

export type Point = { x: number; y: number };

export type GazeRingProps = {
  path: Point[];
  arrivalFrame: number;
  duration?: DurationToken;
  action?: 'click' | 'read' | 'fill';
};

export function GazeRingScope({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function arcPoint(path: Point[], progress: number): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0]!;
  const segmentCount = path.length - 1;
  const scaled = progress * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const localT = scaled - index;
  const a = path[index]!;
  const b = path[index + 1]!;
  // Gently curved, never a straight rail (rule 12): a small perpendicular
  // bulge over each segment, same technique as ObserverCamera's arc.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const bulge = Math.sin(localT * Math.PI) * length * 0.08;
  const perpX = length > 0 ? -dy / length : 0;
  const perpY = length > 0 ? dx / length : 0;
  return {
    x: a.x + dx * localT + perpX * bulge,
    y: a.y + dy * localT + perpY * bulge,
  };
}

export function GazeRing({ path, arrivalFrame, duration = 'deliberate', action }: GazeRingProps) {
  const frame = useCurrentFrame();
  const awareness = useAwareness();

  if (awareness.state === 'L0') {
    // Not an error — silence is the point (rule 13): the absence of the
    // Gaze Ring *is* the depiction of blindness.
    return null;
  }

  const startFrame = arrivalFrame - 32; // travel window; callers can widen via `duration` on the reveal itself
  const progress = tokenInterpolate(frame, startFrame, duration, 0, 1, 'observe');
  const point = arcPoint(path, Math.min(1, Math.max(0, progress)));

  const diameter = GAZE_RING.defaultDiameterFrac * 400; // resolved against a 400px-wide reference; callers scale via CSS
  const strokeWidth = diameter * GAZE_RING.strokeWeightRatio;
  const ringColor = awareness.state === 'L2' || awareness.state === 'L1' ? N['900'] : N['000'];
  const catchlightAngle = ((GAZE_RING.catchlightAngleDeg - 90) * Math.PI) / 180;
  const catchlightR = diameter * 0.09;
  const catchlightCx = diameter / 2 + (diameter / 2 - strokeWidth / 2) * Math.cos(catchlightAngle);
  const catchlightCy = diameter / 2 + (diameter / 2 - strokeWidth / 2) * Math.sin(catchlightAngle);

  // Confirm settle at arrival: a subtle scale-down, never a pulse (§I.6
  // rule 12 — never blinks, pulses, spins, or trails particles).
  const settleScale = action ? tokenInterpolate(frame, arrivalFrame, 'micro', 1, 0.92, 'shift') : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: point.x - diameter / 2,
        top: point.y - diameter / 2,
        width: diameter,
        height: diameter,
        transform: `scale(${settleScale})`,
      }}
    >
      <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={diameter / 2 - strokeWidth / 2}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
        />
        <circle cx={catchlightCx} cy={catchlightCy} r={catchlightR} fill={ringColor} />
      </svg>
    </div>
  );
}
