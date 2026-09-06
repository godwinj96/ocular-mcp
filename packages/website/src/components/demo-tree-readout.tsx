import { useRef } from 'react';
import { SectionHeader } from './section-header.js';
import { useInView } from '../hooks/use-in-view.js';
import { usePrefersReducedMotion } from '../hooks/use-reduced-motion.js';
import { TesseraDashboard } from './specimen/tessera-dashboard.js';
import { SpecimenFrame } from './specimen/specimen-frame.js';
import { useTreeRows, FOLD_Y } from '../hooks/use-tree-rows.js';
import { ReadoutOverlay, useReadoutCycle, reachedAt, CYCLE_MS } from './readout-overlay.js';

// S1 · Two readings of the same frame.
//
// This section answers the objection that actually costs sales: "a screenshot
// MCP already exists, I wrote one in a weekend." The answer is that the
// picture alone is table stakes — what ships alongside it is a labelled tree
// that knows what's in view and what's below the fold, and the two have holes
// only the other can fill. The canvas is unreadable to the tree (it's just an
// unnamed node); the below-fold rows are invisible to the picture.
//
// The composition is two columns separated by ONE vertical hairline. No outer
// border, no background fill — the columns are the composition. That is the
// founder's "no bounding boxes" note applied literally.
//
// ROUND 7 — the founder: "the 2nd demo isnt animated and the bounding boxes
// aren't complete. Make it like the hero demo with the animated scanlines and
// animated grouped bounding boxes." Both true. This section had no scan line
// at all and a dim opacity throb (`box-pulse`) that left most boxes sitting at
// rest at any given instant, so a complete set of boxes read as a partial one.
// It now mounts the SAME instrument the hero does — one component, so the two
// cannot drift — and the boxes carry their role labels here too.
//
// THE ONE THING THIS SECTION ADDS. The tree rows are timed against the same
// scan line: a row lands as the line crosses the element it describes, and the
// below-fold rows land AFTER the line has left the frame entirely, one at a
// time. That is this section's whole claim rendered as motion rather than
// asserted in a caption — the picture stops, and the tree keeps going.

/** Rows past the fold land after the sweep exits, in sequence rather than as
 *  one simultaneous pop — the tree is still reporting after the picture ended. */
const BELOW_FOLD_STAGGER_MS = 320;

export function DemoTreeReadout() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduceMotion = usePrefersReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const rows = useTreeRows(frameRef);
  const { t } = useReadoutCycle(reduceMotion);

  // The rows and the overlay boxes are both MEASURED from the specimen's own
  // DOM (hooks/use-tree-rows.ts, hooks/use-element-boxes.ts) rather than typed
  // out here. Hand-written coordinates were correct on the day they were taken
  // and became fiction the moment the specimen moved — and keeping them in
  // sync by hand is exactly what made swapping this section's specimen
  // expensive enough that it ended up sharing the hero's.
  // Built with a plain loop rather than .map(), because the running
  // below-fold counter has to be shared across iterations. Incrementing it
  // from inside a map callback means a closure mutating a variable that
  // outlives it, which react-hooks/immutability flags — the React Compiler
  // cannot prove that is safe to memoize. The loop keeps the counter local to
  // the render pass and produces identical delays.
  const rowDelays: number[] = [];
  let belowFoldSeen = 0;
  for (const row of rows) {
    if (row.position === 'below-fold') {
      belowFoldSeen += 1;
      rowDelays.push(reachedAt(100) + belowFoldSeen * BELOW_FOLD_STAGGER_MS);
    } else {
      rowDelays.push(reachedAt((row.y / FOLD_Y) * 100));
    }
  }

  return (
    <section
      id="capture"
      className="pb-sec-tail pt-sec"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          eyebrow="The capture"
          heading="Two readings of the same frame"
          deck="Every capture comes back twice: the rendered pixels, and the element tree behind them — annotated with what's in view, what's below the fold, and where each thing sits."
        />
      </div>

      {/* Demos overhang the text measure by 80px per side. */}
      <div ref={ref} className={`demo-loop mx-auto mt-group max-w-demo ${inView ? 'is-live' : ''}`}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[7fr_5fr] lg:gap-0">
          {/* Left — the picture. */}
          <div className="lg:pr-10">
            <p className="mb-stack-1 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              localhost:3000 · 1440 × 900
            </p>
            <div
              ref={frameRef}
              className="relative aspect-[16/10] overflow-hidden rounded border border-rule-mark bg-white"
            >
              {/* The specimen page, laid out at 1440x900 and fitted by the
                  compositor. It replaces five grey bars: a viewer has nothing
                  to recognise in a skeleton, so the demo could not carry the
                  section on its own — which was the founder's note. */}
              {/* A SECOND specimen, not the hero's. The founder's call: "you
                  can't recycle the same page from the hero area to the first
                  demonstration." A dashboard also supplies this section's two
                  claims honestly — a chart canvas a tree genuinely cannot
                  describe, and a table that genuinely runs past the fold. */}
              <SpecimenFrame>
                <TesseraDashboard />
              </SpecimenFrame>

              <ReadoutOverlay frameRef={frameRef} t={t} reduceMotion={reduceMotion} />
            </div>
          </div>

          {/* Right — the tree. One hairline divides them and nothing else. */}
          <div className="lg:border-l lg:border-rule-divider lg:pl-10">
            <p className="mb-stack-1 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              element tree · {rows.length} nodes
            </p>
            <div className="font-mono text-[12.5px] leading-[1.6]">
              {rows.map((row, i) => (
                <div
                  key={`${row.role}-${i}`}
                  className="flex items-baseline gap-3 whitespace-nowrap"
                  style={{
                    opacity: reduceMotion ? 1 : 0.08,
                    animation: reduceMotion ? undefined : `row-cycle ${CYCLE_MS}ms linear infinite`,
                    animationDelay: reduceMotion ? undefined : `${rowDelays[i]}ms`,
                  }}
                >
                  <span className={`text-text-secondary ${row.indent ? 'pl-4' : ''}`}>
                    {row.role}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text-primary">{row.name}</span>
                  <span className="hidden text-text-quaternary sm:inline">{row.coords}</span>
                  <span
                    className={row.position === 'in-view' ? 'text-signal' : 'text-text-inactive'}
                  >
                    {row.position}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-stack-2 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              the picture stops at the fold · the tree doesn&rsquo;t
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
