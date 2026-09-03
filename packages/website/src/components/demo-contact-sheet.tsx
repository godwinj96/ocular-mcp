import { SectionHeader } from './section-header.js';
import { useInView } from '../hooks/use-in-view.js';

// S2 · It sees things move.
//
// The frames sample an ease-out drawer, and the sample positions are the real
// ones: 100, 86, 68, 47, 28, 13, 4, 0 percent. Because the curve decelerates,
// the frames visibly bunch toward the end — a developer reads that asymmetry
// instantly, and it is the entire argument for why a sheet of frames beats a
// description of the motion.
//
// The grid's only lines are its 1px gaps, showing through from the plate
// behind the cells. No cell borders, no outer border.

const CYCLE_MS = 5800;
const CELL_STAGGER_MS = 180;

/** Drawer offset per frame, in percent — an ease-out sample, not a linear one. */
const FRAMES = [100, 86, 68, 47, 28, 13, 4, 0] as const;
const TIMESTAMPS = [0, 40, 80, 120, 160, 200, 240, 280] as const;

export function DemoContactSheet() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="motion"
      className="pt-sec-minor"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          eyebrow="Motion"
          heading="It sees things move"
          deck="Animation, transitions, and scroll-driven UI come back as a sheet of frames — the whole sequence in a single image, so your agent can see the motion without paying for a video."
        />
      </div>

      <div
        ref={ref}
        className={`demo-loop mx-auto mt-demo-gap max-w-demo ${inView ? 'is-live' : ''}`}
      >
        {/* The plate shows through the 1px gaps. That IS the grid. */}
        <div
          className="grid grid-cols-2 overflow-hidden rounded sm:grid-cols-4"
          style={{ gap: '1px', backgroundColor: 'var(--rule-divider)' }}
        >
          {FRAMES.map((offset, i) => (
            <div
              key={i}
              className="relative aspect-[16/10] bg-surface-elevated"
              style={{
                opacity: 0.08,
                animation: `cell-cycle ${CYCLE_MS}ms linear infinite`,
                animationDelay: `${i * CELL_STAGGER_MS}ms`,
              }}
            >
              <span className="absolute left-2.5 top-2 z-10 font-mono text-[10px] leading-none tracking-[0.02em] text-text-quaternary">
                {TIMESTAMPS[i]}ms
              </span>
              {/* Page ground. */}
              <div className="absolute inset-0 overflow-hidden p-[9%] pt-[22%]">
                <div className="h-[6%] w-[46%] rounded-sm bg-surface-raised" />
                <div className="mt-[7%] h-[6%] w-[62%] rounded-sm bg-surface-raised" />
                <div className="mt-[7%] h-[6%] w-[38%] rounded-sm bg-surface-raised" />
              </div>
              {/* The drawer under test. */}
              <div
                className="absolute bottom-0 right-0 top-0 w-[46%] border-l border-rule-mark bg-surface-raised"
                style={{ transform: `translateX(${offset}%)` }}
              >
                <div className="p-[12%]">
                  <div className="h-[7px] w-[60%] rounded-sm bg-text-inactive" />
                  <div className="mt-[10px] h-[5px] w-[80%] rounded-sm bg-rule-mark" />
                  <div className="mt-[7px] h-[5px] w-[52%] rounded-sm bg-rule-mark" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
          8 frames · one image · one request
        </p>
      </div>
    </section>
  );
}
