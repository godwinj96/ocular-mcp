import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/use-reduced-motion.js';

// The page's one signature moment.
//
// ROUND 5 — the founder's note on round 4 was exact: "the window with the a11y
// boxes and the skeleton aren't an animation, they're just a transition. The
// period of motion is too brief; it should be constantly playing to give that
// impression of life." Round 4 was useState plus CSS transitions fired once on
// mount, and its entire motion budget was spent in 2.1 seconds. It then sat
// dead for the rest of the visit, which is exactly why it read as a card with
// a skeleton in it.
//
// So this now runs a perpetual cycle: SWEEP -> ACQUIRE -> READ -> RELEASE ->
// REST, forever, 7400ms per pass.
//
// The correction that matters most: the blur/desaturate resolve does NOT loop.
// Re-blurring every cycle would read as a strobing toy, and it would also be
// dishonest — Ocular does not gradually focus. The resolve stays a one-time
// arrival on mount; the perpetual cycle then runs on the already-resolved
// frame. What repeats is the part that genuinely repeats in the product: it
// scans, it acquires, it reads, it lets go, it waits.
//
// Motion 2000ms, near-still 5400ms. That ratio is the point. The rest phase is
// not padding — without it the loop reads as churn; with it, each pass reads
// as a discrete operation the instrument chose to perform, which is the
// "understated elegance" the founder identified on Linear.

interface Region {
  /** Percentages of the frame, so the overlay scales with the mock. */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// Each box frames a real element in the mock below. A readout that doesn't
// line up with what it points at is just decoration.
const REGIONS: readonly Region[] = [
  { x: 6, y: 18, w: 52, h: 13, label: 'heading' },
  { x: 6, y: 45, w: 27, h: 10, label: 'button' },
  { x: 6, y: 62, w: 88, h: 29, label: 'canvas' },
];

const RESOLVE_START_MS = 520;
const RESOLVE_MS = 900;

const CYCLE_MS = 7400;
const SWEEP_MS = 1100;
const BOX_STAGGER_MS = 190;
const STROKE_DRAW_MS = 260;

/** Cycle-relative milestones. Kept as named constants rather than tokens: these
 *  are storyboard values, not reusable UI durations, and promoting them to CSS
 *  custom properties would invite other components to reach for them. */
const T_ACQUIRE = 1120;
const T_READ = 2200;
const T_HOLD = 4900;
const T_RELEASE = 5400;
const T_REST = 5960;

const READ_ROW_MS = 900;

type Phase = 'scanning' | 'acquiring' | 'reading' | 'idle';

/** Perimeter in the SVG's 0-100 user space, used as the dash length. */
function perimeter(r: Region): number {
  return 2 * (r.w + r.h);
}

export function CaptureReadout() {
  const reduceMotion = usePrefersReducedMotion();
  const [resolved, setResolved] = useState(false);
  /** Milliseconds into the current cycle. Coarse — only the chrome-bar word
   *  and the highlighted row read it; the boxes and sweep are pure CSS. */
  const [t, setT] = useState(0);
  const resolveLayer = useRef<HTMLDivElement>(null);

  // One-time resolve on mount.
  useEffect(() => {
    if (reduceMotion) {
      setResolved(true);
      return;
    }
    const id = setTimeout(() => setResolved(true), RESOLVE_START_MS);
    return () => clearTimeout(id);
  }, [reduceMotion]);

  // The cycle clock. A single interval at 100ms drives two pieces of text; the
  // geometry is all CSS, so this never touches layout.
  useEffect(() => {
    if (reduceMotion) return;
    const startedAt = Date.now();
    const id = setInterval(() => setT((Date.now() - startedAt) % CYCLE_MS), 100);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // will-change is set for the resolve only and dropped afterwards — a
  // permanently promoted layer costs memory for the life of the page.
  useEffect(() => {
    const el = resolveLayer.current;
    if (!el || !resolved || reduceMotion) return;
    el.style.willChange = 'filter, opacity';
    const done = setTimeout(() => {
      el.style.willChange = '';
    }, RESOLVE_MS + 60);
    return () => clearTimeout(done);
  }, [resolved, reduceMotion]);

  // Reduced motion freezes at the t=3000 state: everything acquired, nothing
  // moving, chrome reading idle. A reduced-motion visitor should see MORE
  // information than an animated one, never less.
  const phase: Phase = reduceMotion
    ? 'idle'
    : t < SWEEP_MS
      ? 'scanning'
      : t < T_READ
        ? 'acquiring'
        : t < T_RELEASE
          ? 'reading'
          : 'idle';

  const readRow = reduceMotion
    ? -1
    : t >= T_READ && t < T_HOLD
      ? Math.min(REGIONS.length - 1, Math.floor((t - T_READ) / READ_ROW_MS))
      : -1;

  return (
    <div className="relative">
      {/* Registration marks — alignment ticks on the chassis, offset 6px
          outside the frame so they read as targeting the panel rather than
          decorating it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-[6px] -top-[6px] h-2 w-2 border-l border-t border-rule-mark"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[6px] -top-[6px] h-2 w-2 border-r border-t border-rule-mark"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[6px] -left-[6px] h-2 w-2 border-b border-l border-rule-mark"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[6px] -right-[6px] h-2 w-2 border-b border-r border-rule-mark"
      />

      <div className="relative overflow-hidden rounded border border-rule-mark bg-surface-elevated">
        {/* Chrome bar. The macOS traffic-light dots are deliberately gone —
            they are the most template-coded element available. Mono telemetry
            separated by hairlines reads as an instrument instead, and the
            right-hand word is the loop's own status. */}
        <div className="flex items-center gap-3 border-b border-rule-divider px-4 py-3">
          <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
            localhost:3000
          </span>
          <span className="h-3 w-px bg-rule-structural" />
          <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
            1440 × 900
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span
              className="h-1 w-1 rounded-full transition-colors duration-fast"
              style={{
                backgroundColor: phase === 'idle' ? 'var(--text-inactive)' : 'var(--accent-glow)',
              }}
            />
            <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              {phase}
            </span>
          </span>
        </div>

        <div className="relative aspect-[16/10]">
          <div
            ref={resolveLayer}
            className="absolute inset-0 p-[6%] transition-[filter,opacity] ease-base"
            style={{
              filter: resolved ? 'blur(0px) saturate(1)' : 'blur(12px) saturate(0.2)',
              opacity: resolved ? 1 : 0.55,
              transitionDuration: `${RESOLVE_MS}ms`,
            }}
          >
            <div className="h-[7%] w-[34%] rounded-sm bg-surface-raised" />
            <div className="mt-[5%] h-[13%] w-[52%] rounded-sm bg-text-primary" />
            <div className="mt-[4%] h-[5%] w-[64%] rounded-sm bg-surface-raised" />
            <div className="mt-[5%] h-[10%] w-[27%] rounded-full bg-accent" />
            {/* The blank canvas the readout reports on. */}
            <div className="mt-[7%] h-[29%] w-[88%] rounded-sm border border-rule-structural" />
          </div>

          {/* Vignette arrives WITH the resolve. A static vignette is texture;
              one that lands on the resolve is an optical event. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity ease-base"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 0%, transparent 38%, rgba(9,9,11,0.74) 100%)',
              opacity: resolved ? 1 : 0,
              transitionDuration: `${RESOLVE_MS}ms`,
            }}
          />

          {/* The scan line. Two stacked rules — a 1px core and a 3px
              low-opacity spread underneath it — because a wide faint stroke
              gives the bloom without a shadow or a gradient, which the concept
              forbids outright. Runs at constant velocity: a scanner that eases
              is decoration, one that runs linearly is a mechanism. */}
          {resolved && !reduceMotion && (
            <div
              aria-hidden="true"
              // Full-height wrapper: translateY percentages resolve against
              // the element's own height, so 100% here is exactly one frame
              // of travel regardless of the panel's rendered size.
              className="pointer-events-none absolute inset-0 h-full"
              style={{
                ['--sweep-travel' as string]: '100%',
                animation: `readout-sweep ${CYCLE_MS}ms linear infinite`,
              }}
            >
              <div className="h-[3px] w-full bg-accent-glow opacity-10" />
              <div className="-mt-[2px] h-px w-full bg-accent-glow opacity-[0.55]" />
            </div>
          )}

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {REGIONS.map((r, i) => {
              const p = perimeter(r);
              // The box draws, holds, and retracts, once per cycle. Animating
              // opacity here would be decoration appearing; animating
              // stroke-dashoffset is an instrument acquiring a target, and
              // that distinction is the single biggest reason round 4's
              // version read as a skeleton.
              const draw = reduceMotion
                ? undefined
                : {
                    animation: `readout-box ${CYCLE_MS}ms var(--ease-draw) infinite`,
                    animationDelay: `${i * BOX_STAGGER_MS}ms`,
                  };
              const lit = readRow === i;
              return (
                <g key={r.label}>
                  {/* Under-stroke carries the glow. A wide low-opacity stroke
                      is not a shadow, so it stays inside the concept's rules. */}
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill="none"
                    stroke="var(--accent-glow)"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      ['--p' as string]: p,
                      strokeDasharray: p,
                      strokeDashoffset: reduceMotion ? 0 : undefined,
                      opacity: lit ? 0.2 : 0.12,
                      transition: `opacity ${STROKE_DRAW_MS}ms var(--ease)`,
                      ...draw,
                    }}
                  />
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill="none"
                    stroke="var(--accent-glow)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      ['--p' as string]: p,
                      strokeDasharray: p,
                      strokeDashoffset: reduceMotion ? 0 : undefined,
                      opacity: lit ? 1 : 0.9,
                      transition: `opacity ${STROKE_DRAW_MS}ms var(--ease)`,
                      ...draw,
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Labels sit outside the stretched SVG so their typography stays
              square. */}
          {REGIONS.map((r, i) => (
            <span
              key={r.label}
              className="pointer-events-none absolute font-mono text-[10px] font-medium leading-none tracking-[0.06em] text-accent-glow"
              style={{
                left: `${r.x}%`,
                top: `calc(${r.y}% - 13px)`,
                opacity: reduceMotion ? 1 : 0,
                animation: reduceMotion
                  ? undefined
                  : `readout-label ${CYCLE_MS}ms var(--ease) infinite`,
                animationDelay: reduceMotion ? undefined : `${i * BOX_STAGGER_MS}ms`,
              }}
            >
              {r.label}
            </span>
          ))}
        </div>
      </div>
    </div>
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
