import { useEffect, useState, type RefObject } from 'react';
import { useElementBoxes, type ElementBox } from '../hooks/use-element-boxes.js';

// The instrument overlay: a scan line, a box on every element it finds, and a
// label on every box. Shared by the hero readout and the tree-readout demo.
//
// WHY IT IS SHARED. The founder's round-7 note was that the second demo "isnt
// animated and the bounding boxes aren't complete. Make it like the hero demo
// with the animated scanlines and animated grouped bounding boxes." The
// obvious fix is to copy the hero's overlay into the other section — and that
// is how the two would immediately drift, because from then on every tuning
// pass has to be made twice and nothing fails when it is only made once. One
// component, two mounts.
//
// What was actually wrong with the second demo, precisely:
//
//   - NO SWEEP. It had `box-pulse` only, a dim opacity throb with no scan line
//     at all, so nothing in it read as an act of looking.
//   - THE BOXES LOOKED INCOMPLETE. They were complete — every box was in the
//     DOM — but `box-pulse` spends most of its cycle near its resting opacity
//     and each box carried a 260ms stagger, so at any given instant most of
//     them sat at 0.9 and a few flared. The eye reads "some boxes" from that,
//     which is the opposite of the claim.
//   - NO LABELS. The hero names every box; this one named none, which
//     demonstrates that Ocular found something without demonstrating that it
//     knows what it found.
//
// The cycle is the hero's, unchanged: SWEEP -> ACQUIRE -> READ -> RELEASE ->
// REST. Motion 2000ms, near-still 5400ms. The rest phase is not padding —
// without it the loop reads as churn; with it each pass reads as a discrete
// operation the instrument chose to perform.

export const CYCLE_MS = 7400;
const SWEEP_MS = 1100;
const STROKE_DRAW_MS = 260;

/** Cycle-relative milestones. Kept as named constants rather than tokens:
 *  these are storyboard values, not reusable UI durations, and promoting them
 *  to CSS custom properties would invite other components to reach for them. */
const T_ACQUIRE = 1120;
const T_READ = 2200;
const T_HOLD = 4900;
const T_RELEASE = 5400;
const T_REST = 5960;

const READ_ROW_MS = 900;

/** Rows lit during READ, capped: cycling a highlight through forty boxes would
 *  take longer than the whole loop and read as flicker. */
const LIT_ROWS = 3;

export type Phase = 'scanning' | 'acquiring' | 'reading' | 'idle';

/** When the scan line crosses a box's BOTTOM edge, in ms into the cycle. */
export function acquireAt(r: Pick<ElementBox, 'y' | 'h'>): number {
  return ((r.y + r.h) / 100) * SWEEP_MS;
}

/**
 * When something at `yPct` down the frame is reached by the scan line.
 *
 * Used by consumers that animate alongside the overlay — the tree readout
 * lands each row as the line crosses the element that row describes, so the
 * two columns are demonstrably reading the same frame at the same instant
 * rather than running two loops that happen to look similar.
 */
export function reachedAt(yPct: number): number {
  return (Math.min(100, Math.max(0, yPct)) / 100) * SWEEP_MS;
}

/**
 * The cycle clock.
 *
 * A single 100ms interval drives text only — the geometry is all CSS, so this
 * never touches layout. Each mount runs its own clock and the two demos are
 * deliberately NOT synchronised to each other: two instruments ticking in
 * lockstep down the page reads as one animation with a repeat, not as two
 * captures.
 */
export function useReadoutCycle(reduceMotion: boolean): { t: number; phase: Phase } {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const startedAt = Date.now();
    const id = setInterval(() => setT((Date.now() - startedAt) % CYCLE_MS), 100);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // Reduced motion freezes at the everything-acquired state: nothing moving,
  // chrome reading idle. A reduced-motion visitor should see MORE information
  // than an animated one, never less.
  const phase: Phase = reduceMotion
    ? 'idle'
    : t < SWEEP_MS
      ? 'scanning'
      : t < T_READ
        ? 'acquiring'
        : t < T_RELEASE
          ? 'reading'
          : 'idle';

  return { t, phase };
}

interface ReadoutOverlayProps {
  /** The frame whose DOM is measured. Boxes are derived, never hand-listed. */
  frameRef: RefObject<HTMLElement>;
  /** Cycle position from `useReadoutCycle`, so chrome and boxes agree. */
  t: number;
  reduceMotion: boolean;
  /** The hero holds the sweep back until its one-time resolve has landed. */
  showSweep?: boolean;
}

export function ReadoutOverlay({
  frameRef,
  t,
  reduceMotion,
  showSweep = true,
}: ReadoutOverlayProps) {
  // Every element in the frame, in the order the scan line reaches them.
  const boxes = useElementBoxes(frameRef);

  // All delays are relative to the earliest acquisition, so no box carries a
  // negative animation-delay (which would render it already-acquired at t=0).
  const firstAcquire = boxes.length > 0 ? acquireAt(boxes[0]!) : 0;

  const readRow = reduceMotion
    ? -1
    : t >= T_READ && t < T_HOLD
      ? Math.min(LIT_ROWS - 1, Math.floor((t - T_READ) / READ_ROW_MS))
      : -1;

  return (
    <>
      {/* The scan line. Two stacked rules — a 1px core and a 3px low-opacity
          spread underneath it — because a wide faint stroke gives the bloom
          without a shadow or a gradient, which the concept forbids outright.
          Runs at constant velocity: a scanner that eases is decoration, one
          that runs linearly is a mechanism. */}
      {showSweep && !reduceMotion && (
        <div
          aria-hidden="true"
          // Full-height wrapper: translateY percentages resolve against the
          // element's own height, so 100% here is exactly one frame of travel
          // regardless of the panel's rendered size.
          className="pointer-events-none absolute inset-0 h-full"
          style={{
            ['--sweep-travel' as string]: '100%',
            animation: `readout-sweep ${CYCLE_MS}ms linear infinite`,
          }}
        >
          <div className="h-[3px] w-full bg-signal-ink opacity-[0.22]" />
          <div className="-mt-[2px] h-px w-full bg-signal-ink opacity-[0.95]" />
        </div>
      )}

      {/* The boxes are positioned divs, NOT an SVG. The SVG used
          viewBox="0 0 100 100" with preserveAspectRatio="none" over a 16/10
          frame, so its user space was square while its rendering was not — a
          uniform scale() in that space comes out visibly wider than taller,
          fatal for a gesture whose whole meaning is a box converging on an
          element. As divs the scale is uniform for free.

          The motion is a fade-in oversized then a scale down onto the element,
          not a stroke that draws. The verbs differ: a stroke that draws is
          AUTHORING — "we made this box" — while a box that converges is
          FINDING something already there. Ocular measures what exists, so
          convergence is the correct verb.

          Each box acquires as the scan line crosses its own bottom edge, so
          the sweep is causal rather than ceremonial: the line finds the
          element, the box lands on it. */}
      {boxes.map((r, i) => {
        const lit = readRow === i;
        const acquire = reduceMotion
          ? undefined
          : {
              animation: `readout-acquire ${CYCLE_MS}ms var(--ease-acquire) infinite`,
              animationDelay: `${Math.max(0, acquireAt(r) - firstAcquire)}ms`,
            };
        return (
          <div
            key={`box-${r.tag}-${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.w}%`,
              height: `${r.h}%`,
              opacity: reduceMotion ? 1 : 0,
              willChange: 'transform, opacity',
              ...acquire,
            }}
          >
            {/* The glow is a wide low-opacity border, not a shadow, so it
                stays inside the concept's rules. */}
            <span
              className="absolute -inset-px block border-[3px] border-signal-ink transition-opacity ease-base"
              style={{ opacity: lit ? 0.3 : 0.22, transitionDuration: `${STROKE_DRAW_MS}ms` }}
            />
            <span
              className="absolute inset-0 block border border-signal-ink transition-opacity ease-base"
              style={{ opacity: lit ? 1 : 0.95, transitionDuration: `${STROKE_DRAW_MS}ms` }}
            />
          </div>
        );
      })}

      {/* Labels are separate from the boxes so they do not inherit the acquire
          scale — a label that scaled with its box would blur its own type on
          the way in. They ride the same per-box delay. */}
      {boxes.map((r, i) => (
        <span
          key={`label-${r.tag}-${i}`}
          className="pointer-events-none absolute font-mono text-[8px] font-medium leading-none tracking-[0.02em] text-signal-ink"
          style={{
            left: `${r.x}%`,
            top: `calc(${r.y}% - 9px)`,
            opacity: reduceMotion ? 1 : 0,
            animation: reduceMotion
              ? undefined
              : `readout-label ${CYCLE_MS}ms var(--ease) infinite`,
            animationDelay: reduceMotion
              ? undefined
              : `${Math.max(0, acquireAt(r) - firstAcquire)}ms`,
          }}
        >
          {r.tag}
        </span>
      ))}
    </>
  );
}

// Cycle milestones referenced by the CSS keyframes in tokens.css, kept here so
// the storyboard and its percentages can be checked against each other:
//   0 -> 1100   SWEEP    scan line crosses the frame at constant velocity
//   1120        ACQUIRE  boxes draw, 190ms apart, 260ms each
//   2200 -> 4900 READ    one row lit per 900ms
//   5400        RELEASE  labels fade, boxes retract in reverse
//   5960 -> 7400 REST    a completely still, empty frame
export const READOUT_CYCLE = {
  CYCLE_MS,
  T_ACQUIRE,
  T_READ,
  T_HOLD,
  T_RELEASE,
  T_REST,
} as const;
