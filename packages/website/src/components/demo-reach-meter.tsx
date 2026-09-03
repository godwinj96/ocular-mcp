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
        className="pb-sec-md pt-sec-lg"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <SectionHeader
            eyebrow="Two paths"
            heading="Your machine, and the open web"
            deck="Captures of your own dev server run locally and aren't metered. Public pages go out through Ocular instead, against a daily allowance you can see."
          />
        </div>

        <div
          ref={ref}
          className={`demo-loop mx-auto mt-[112px] max-w-demo ${inView ? 'is-live' : ''}`}
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
              <div className="flex min-w-0 flex-1 items-center gap-[3px]">
                {Array.from({ length: BASIC_QUOTA }, (_, i) => (
                  <span
                    key={i}
                    className="h-[10px] min-w-[2px] flex-1 bg-text-inactive"
                    style={
                      i < CLOUD_USED
                        ? {
                            animation: `slot-fill ${CLOUD_CYCLE_MS}ms linear infinite`,
                            animationDelay: `${i * CLOUD_STAGGER_MS}ms`,
                          }
                        : undefined
                    }
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
          <p className="mt-9 max-w-[66ch] text-[15px] leading-[1.6] text-text-tertiary [text-wrap:pretty]">
            Most of the open web comes back fine. Some sites work hard to keep automated browsers
            out, and against those a request can still fail. When it does you get a clear failure
            with a reason rather than a hang — and the allowance isn&rsquo;t spent on nothing.
          </p>
        </div>
      </section>
    </>
  );
}
