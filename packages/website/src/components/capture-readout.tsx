import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// The page's one signature moment, specified in the "Instrument" concept:
//
//   "Hero screenshot dissolves into a top-down vignette; at the dissolve
//    point, a11y-tree bounding boxes draw on one-by-one in accent-glow cyan
//    — a targeting readout. Nothing else animates beyond default hover
//    states."
//
// The previous attempt read as "just a card with a skeleton in it." Four
// corrections, each load-bearing:
//
//   1. The boxes DRAW rather than fade. Animating opacity on a <rect> is
//      decoration appearing; animating stroke-dashoffset is an instrument
//      acquiring a target. This is the single biggest difference and it is
//      why the last pass read as a skeleton.
//   2. A 420ms hold between the resolve and the first box, so the sequence
//      reads as two distinct events instead of one continuous blur.
//   3. A 520ms delay before anything starts. The panel is above the fold and
//      already visible at first paint, so starting at t=0 spends the moment
//      while the eye is still on the headline.
//   4. Corner ticks snap in linearly after each box lands — the "acquired"
//      beat. Easing it kills the snap.
//
// Motion is confined to opacity / transform / filter / stroke-dashoffset, and
// the whole sequence resolves to its end state under prefers-reduced-motion.

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

const START_DELAY_MS = 520;
const RESOLVE_MS = 900;
const HOLD_MS = 420;
const BOX_STAGGER_MS = 190;
const STROKE_DRAW_MS = 260;

/** Perimeter in the SVG's 0-100 user space, used as the dash length. */
function perimeter(r: Region): number {
  return 2 * (r.w + r.h);
}

export function CaptureReadout() {
  const reduceMotion = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [drawn, setDrawn] = useState(0);
  const [acquired, setAcquired] = useState(0);
  const resolveLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion) {
      setStarted(true);
      setDrawn(REGIONS.length);
      setAcquired(REGIONS.length);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStarted(true), START_DELAY_MS));
    for (let i = 0; i < REGIONS.length; i++) {
      timers.push(
        setTimeout(
          () => setDrawn(i + 1),
          START_DELAY_MS + RESOLVE_MS + HOLD_MS + i * BOX_STAGGER_MS,
        ),
      );
      timers.push(
        setTimeout(
          () => setAcquired(i + 1),
          START_DELAY_MS + RESOLVE_MS + HOLD_MS + i * BOX_STAGGER_MS + STROKE_DRAW_MS,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  // will-change is set for the resolve only and dropped afterwards — a
  // permanently promoted layer costs memory for the life of the page.
  useEffect(() => {
    const el = resolveLayer.current;
    if (!el || !started || reduceMotion) return;
    el.style.willChange = 'filter, opacity';
    const done = setTimeout(() => {
      el.style.willChange = '';
    }, RESOLVE_MS + 60);
    return () => clearTimeout(done);
  }, [started, reduceMotion]);

  return (
    <div className="relative">
      {/* Registration marks — alignment ticks on the chassis, offset 6px
          outside the frame so they read as targeting the panel rather than
          decorating it. Four L-shapes, 8px arms, drawn with borders so they
          stay exactly 1px at any zoom. */}
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
            they are the most template-coded element available. Mono metadata
            separated by a hairline reads as instrument telemetry instead. */}
        <div className="flex items-center gap-3 border-b border-rule-divider px-4 py-3">
          <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
            localhost:3000
          </span>
          <span className="h-3 w-px bg-rule-structural" />
          <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
            1440 × 900
          </span>
        </div>

        <div className="relative aspect-[16/10]">
          <div
            ref={resolveLayer}
            className="absolute inset-0 p-[6%] transition-[filter,opacity] ease-base"
            style={{
              filter: started ? 'blur(0px) saturate(1)' : 'blur(12px) saturate(0.2)',
              opacity: started ? 1 : 0.55,
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
              opacity: started ? 1 : 0,
              transitionDuration: `${RESOLVE_MS}ms`,
            }}
          />

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {REGIONS.map((r, i) => {
              const p = perimeter(r);
              const isDrawn = i < drawn;
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
                    opacity="0.12"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      strokeDasharray: p,
                      strokeDashoffset: isDrawn ? 0 : p,
                      transition: `stroke-dashoffset ${STROKE_DRAW_MS}ms cubic-bezier(0.33,1,0.68,1)`,
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
                    opacity="0.9"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      strokeDasharray: p,
                      strokeDashoffset: isDrawn ? 0 : p,
                      transition: `stroke-dashoffset ${STROKE_DRAW_MS}ms cubic-bezier(0.33,1,0.68,1)`,
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Labels and corner ticks sit outside the stretched SVG so their
              typography and geometry stay square. */}
          {REGIONS.map((r, i) => (
            <span
              key={r.label}
              className="pointer-events-none absolute font-mono text-[10px] font-medium leading-none tracking-[0.06em] text-accent-glow"
              style={{
                left: `${r.x}%`,
                top: `calc(${r.y}% - 13px)`,
                opacity: i < acquired ? 1 : 0,
                transform: i < acquired ? 'translateY(0)' : 'translateY(3px)',
                transition:
                  'opacity 180ms cubic-bezier(0.16,1,0.3,1), transform 180ms cubic-bezier(0.16,1,0.3,1)',
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
