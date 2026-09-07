import { SectionHeader, BleedRule } from './section-header.js';
import { useInView } from '../hooks/use-in-view.js';

// S3 · Your machine, and the open web.
//
// Two rows that behave differently, and the difference IS the pricing
// explanation — no copy required. The localhost row's ticks accumulate and
// never reach a limit; the public row fills a track with a hard end. A viewer
// should be able to predict which row a new address lands in, and that
// predictability is the reassurance: nothing leaves the machine by accident,
// because the rule is visible.
//
// The two loops are deliberately out of phase. A shared beat would read as
// decoration rather than as two independent meters.

const LOCAL_CYCLE_MS = 4200;
const LOCAL_TICKS = 14;
const LOCAL_STAGGER_MS = 300;

const CLOUD_CYCLE_MS = 4800;
const CLOUD_USED = 12;
const CLOUD_STAGGER_MS = 150;

// Mirrors DAILY_CLOUD_QUOTA_BY_TIER.basic in @ocular/shared's plans.ts. The
// website has no dependency on that package (it is a static Vite build), so
// the number is duplicated here the same way pricing.tsx duplicates it — if
// the two ever disagree, plans.ts wins and this gets updated, never the
// reverse. A meter showing a quota the product doesn't enforce is worse than
// no meter.
const BASIC_QUOTA = 40;

export function DemoReachMeter() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <>
      <BleedRule />
      <section
        id="reach"
        className="pb-sec-tail pt-sec"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          {/* The old deck stated two facts and no relationship between them,
              which is why this section made the two-paths point without ever
              saying why both TOGETHER matters. The third sentence is the
              missing claim: your agent cannot predict which side it will need,
              so a tool covering one hands the work back to you.

              The caching benefit stops at SPEED here, but that is now a
              choice rather than a constraint: PRD §9 open decision 1 was
              DECIDED on 2026-09-06 — a cloud cache hit costs HALF. Copy may
              claim the discount if a copy pass judges it worth the words. It
              must never claim a hit is free; that framing is withdrawn. */}
          <SectionHeader
            eyebrow="Two paths"
            heading="Both, from one connection"
            deck="Your dev server renders on your machine and isn't metered. Public pages go out through Ocular against a daily allowance you can see. Your agent doesn't have to know in advance which one it will need, and a public page rendered recently comes straight back."
          />
        </div>

        <div
          ref={ref}
          className={`demo-loop mx-auto mt-group max-w-demo ${inView ? 'is-live' : ''}`}
        >
          <div className="divide-y divide-rule-divider border-y border-rule-divider">
            {/* Row A — unmetered, and visibly without an end. */}
            <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:gap-10">
              <p className="w-[280px] shrink-0 font-mono text-[13px] leading-none tracking-[0.01em] text-text-primary">
                localhost:3000
              </p>
              <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
                {Array.from({ length: LOCAL_TICKS }, (_, i) => (
                  <span
                    key={i}
                    className="h-[10px] w-[3px] shrink-0 bg-text-secondary"
                    style={{
                      opacity: 0,
                      animation: `tick-in ${LOCAL_CYCLE_MS}ms linear infinite`,
                      animationDelay: `${i * LOCAL_STAGGER_MS}ms`,
                    }}
                  />
                ))}
              </div>
              <p className="shrink-0 font-mono text-[11.5px] leading-none tracking-[0.02em] text-text-secondary">
                unmetered
              </p>
            </div>

            {/* Row B — a track with a hard end. */}
            <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:gap-10">
              <p className="w-[280px] shrink-0 truncate font-mono text-[13px] leading-none tracking-[0.01em] text-text-primary">
                https://stripe.com/pricing
              </p>
              {/* FIXED slots that wrap, not flex-1.
                  Dividing the track by the slot count makes the proportion a
                  function of the container: measured at 1440px these rendered
                  18.15 x 10px = 1.82:1, which is the founder's note that the
                  rail reads wrong. A slot nearly twice as wide as it is tall
                  stops reading as a tick and starts reading as a dash, and a
                  row of dashes reads as a dashed line rather than as something
                  countable -- which is the whole job of this row.

                  At 6 x 14 (0.43:1) the shape no longer depends on the
                  container or the cap, and the row wraps instead of stretching.
                  Only the geometry changes: slot-fill animates
                  background-color and nothing else, so the sequence is
                  untouched. */}
              <div
                className="flex min-w-0 flex-1 flex-wrap content-center items-center"
                style={{ gap: 'var(--rail-row-gap) var(--rail-gap)' }}
              >
                {Array.from({ length: BASIC_QUOTA }, (_, i) => (
                  <span
                    key={i}
                    className="bg-text-inactive"
                    style={{
                      width: 'var(--rail-slot-w)',
                      height: 'var(--rail-slot-h)',
                      ...(i < CLOUD_USED
                        ? {
                            animation: `slot-fill ${CLOUD_CYCLE_MS}ms linear infinite`,
                            animationDelay: `${i * CLOUD_STAGGER_MS}ms`,
                          }
                        : {}),
                    }}
                  />
                ))}
              </div>
              <p className="shrink-0 font-mono text-[11.5px] leading-none tracking-[0.02em] text-text-secondary">
                {CLOUD_USED} / {BASIC_QUOTA} today
              </p>
            </div>
          </div>

          {/* The honesty beat. Base tier clears most of the open web, not all
              of it — CLAUDE.md's base-tier-honesty guardrail, stated where a
              reader forms the expectation rather than buried in the FAQ. */}
          <p className="mt-group max-w-[66ch] text-[15px] leading-[1.6] text-text-tertiary [text-wrap:pretty]">
            Most of the open web comes back fine. Some sites work hard to keep automated browsers
            out, and against those a request can still fail. When it does you get a clear failure
            with a reason rather than a hang, and the allowance isn&rsquo;t spent on nothing.
          </p>
        </div>
      </section>
    </>
  );
}
