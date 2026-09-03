import { SectionHeader } from './section-header.js';
import { useInView } from '../hooks/use-in-view.js';

// S1 · Two readings of the same frame.
//
// This section answers the objection that actually costs sales: "a screenshot
// MCP already exists, I wrote one in a weekend." The answer is that the
// picture alone is table stakes — what ships alongside it is a labelled tree
// that knows what's in view and what's below the fold, and the two have holes
// only the other can fill. The canvas is unreadable to the tree (it's just an
// unnamed node); the three below-fold rows are invisible to the picture.
//
// The composition is two columns separated by ONE vertical hairline. No outer
// border, no background fill — the columns are the composition. That is the
// founder's "no bounding boxes" note applied literally.

const CYCLE_MS = 6240;
const ROW_STAGGER_MS = 260;

interface TreeRow {
  indent: 0 | 1;
  role: string;
  name: string;
  coords: string;
  /** Drives the colour of the position column, and it is the payload. */
  position: 'in-view' | 'below-fold';
  /** Index of the region box this row points at, if any. */
  region?: number;
}

const ROWS: readonly TreeRow[] = [
  { indent: 0, role: 'main', name: '', coords: '', position: 'in-view' },
  {
    indent: 1,
    role: 'h1',
    name: '"Checkout"',
    coords: '24,118  480×34',
    position: 'in-view',
    region: 0,
  },
  {
    indent: 1,
    role: 'button',
    name: '"Place order"',
    coords: '24,266  168×40',
    position: 'in-view',
    region: 1,
  },
  {
    indent: 1,
    role: 'canvas',
    name: '[no accessible name]',
    coords: '24,352 1160×290',
    position: 'in-view',
    region: 2,
  },
  { indent: 0, role: 'section', name: '"Order summary"', coords: '', position: 'below-fold' },
  {
    indent: 1,
    role: 'p',
    name: '"3 items · $184.00"',
    coords: '24,1042 312×20',
    position: 'below-fold',
  },
];

const REGIONS = [
  { x: 6, y: 18, w: 52, h: 13 },
  { x: 6, y: 45, w: 27, h: 10 },
  { x: 6, y: 62, w: 88, h: 29 },
] as const;

export function DemoTreeReadout() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      className="pb-sec-md pt-sec-lg"
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
      <div
        ref={ref}
        className={`demo-loop mx-auto mt-[112px] max-w-demo ${inView ? 'is-live' : ''}`}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[7fr_5fr] lg:gap-0">
          {/* Left — the picture. */}
          <div className="lg:pr-10">
            <p className="mb-4 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              localhost:3000 · 1440 × 900
            </p>
            <div className="relative aspect-[16/10] overflow-hidden rounded border border-rule-mark bg-surface-elevated">
              <div className="absolute inset-0 p-[6%]">
                <div className="h-[7%] w-[34%] rounded-sm bg-surface-raised" />
                <div className="mt-[5%] h-[13%] w-[52%] rounded-sm bg-text-primary" />
                <div className="mt-[4%] h-[5%] w-[64%] rounded-sm bg-surface-raised" />
                <div className="mt-[5%] h-[10%] w-[27%] rounded-full bg-accent" />
                <div className="mt-[7%] h-[29%] w-[88%] rounded-sm border border-rule-structural" />
              </div>

              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {REGIONS.map((r, i) => (
                  <rect
                    key={i}
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill="none"
                    stroke="var(--accent-glow)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      opacity: 0.9,
                      animation: `box-pulse ${CYCLE_MS}ms linear infinite`,
                      // +1 because row 0 ("main") points at no region.
                      animationDelay: `${(i + 1) * ROW_STAGGER_MS}ms`,
                    }}
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* Right — the tree. One hairline divides them and nothing else. */}
          <div className="lg:border-l lg:border-rule-divider lg:pl-10">
            <p className="mb-4 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              element tree · 6 nodes
            </p>
            <div className="font-mono text-[12.5px] leading-[1.6]">
              {ROWS.map((row, i) => (
                <div
                  key={`${row.role}-${i}`}
                  className="flex items-baseline gap-3 whitespace-nowrap"
                  style={{
                    opacity: 0.08,
                    animation: `row-cycle ${CYCLE_MS}ms linear infinite`,
                    animationDelay: `${i * ROW_STAGGER_MS}ms`,
                  }}
                >
                  <span className={`text-text-secondary ${row.indent ? 'pl-4' : ''}`}>
                    {row.role}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text-primary">{row.name}</span>
                  <span className="hidden text-text-quaternary sm:inline">{row.coords}</span>
                  <span
                    className={
                      row.position === 'in-view' ? 'text-accent-glow' : 'text-text-inactive'
                    }
                  >
                    {row.position}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              the picture stops at the fold · the tree doesn&rsquo;t
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
