import { SectionHeader } from './section-header.js';
import { BrandName } from './brand-name.js';
import { useInView } from '../hooks/use-in-view.js';

// Round 5 deleted the previous how-it-works.tsx — four icon rows of
// capability copy, which is a feature grid wearing a process's name. This is
// a real sequence.
//
// The mechanic is a numbered vertical hairline whose segments extend as the
// section enters view. Researched, not chosen from memory: across seventeen
// developer-tool sites (linear, stripe, vercel, supabase, planetscale,
// raycast, resend, railway, modal, liveblocks, knock, chromatic, prisma,
// cal, sentry, inngest, browserbase) NOT ONE ships a numbered vertical
// stepper on its home page, and not one uses `animation-timeline` /
// `scroll-timeline` at all. So the finding argued for restraint: a
// sticky scroll-scrubber would spend back the 131KB -> 81KB gzip the round-4
// rewrite won by dropping framer-motion and ogl, on a page whose whole
// premise is not being heavier than the lightweight product it sells.
//
// VOICE RULE, load-bearing — Ocular is not the agent and decides nothing.
// Ocular is never the subject of a verb of decision, intention, judgement or
// authorship. It may be the subject of verbs of mechanism: renders, returns,
// captures, comes up, waits, comes back, fails, costs. The AGENT is the
// subject of: decides, asks, looks, checks, describes, builds, changes,
// retries. Where either could be the subject, name Ocular rather than saying
// "it" — the page uses "it" for the agent above the fold and was using it for
// Ocular below, with nothing marking the switch. That collision is what made
// steps 04 and 05 read as though Ocular were doing the building.
//
// A hairline is also the page's existing grammar — BleedRule, the FAQ's
// divide-y rows, rule-hairline at 0.5px on 2dppx — so a rule that extends is
// that grammar given a verb, not a new widget bolted on.
const SETUP = [
  {
    n: '01',
    label: 'Add one line to your MCP config',
    body: "The same block in Claude Code, Cursor, Windsurf, Cline, Zed. There's nothing client-specific in it.",
  },
  {
    n: '02',
    label: 'Sign in once',
    body: "One tab, one click, and it closes. You won't be asked again on this machine.",
  },
] as const;

// The loop is bracketed because that is the actual product promise: setup is
// finite, the loop is perpetual. The bracket says in one glance what the copy
// would otherwise spend three sentences on.
//
// THESE THREE CARRY NO NUMBER, and that is the fix for a defect the round-8
// copy audit found: the heading says "Two steps, then it's automatic" while
// the stepper rendered 01 through 05. A reader counts five. Numbering the
// automatic part identically to the part the reader performs contradicts the
// heading in a single eyeful — on the one section whose entire claim is that
// setup is trivial. They keep the marker slot so the rule still reads as one
// continuous line with stops, but the glyph is a "then", not a count.
const LOOP = [
  {
    n: '→',
    label: 'Your agent connects. Ocular wakes.',
    body: 'Ocular comes up in the background the moment your session starts, and waits there. Nothing cold-starts when your agent first asks to look.',
  },
  {
    n: '→',
    label: 'Your agent decides when to look',
    body: "You don't call a tool and you don't paste a screenshot. You just describe what you're building. Your agent calls Ocular on its own, whenever it needs to see the result.",
  },
  {
    n: '→',
    label: 'Your agent looks, then keeps building',
    body: 'Rendered pixels come back, plus the element tree behind them. Your agent reads both, changes the code, and looks again.',
  },
] as const;

function Step({ n, label, body, i }: { n: string; label: string; body: string; i: number }) {
  return (
    <li
      className="hiw-step grid grid-cols-[34px_1fr] gap-5 pb-stack-3 sm:grid-cols-[46px_1fr] sm:gap-7"
      style={{ ['--i' as string]: i }}
    >
      {/* The number sits ON the rule and masks it — the rule passes behind,
          which is what makes it read as one continuous line with stops
          rather than as five disconnected segments. */}
      <span className="relative -mt-px flex h-6 items-start bg-surface-base font-mono text-[13px] leading-none tracking-[0.02em] text-text-quaternary">
        {n}
      </span>
      <div className="-mt-1 max-w-[54ch]">
        <h3 className="text-[19px] font-medium leading-[1.35] tracking-[-0.014em] text-text-primary [text-wrap:balance]">
          {label}
        </h3>
        <p className="mt-stack-1 text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
          {body}
        </p>
      </div>
    </li>
  );
}

export function HowItWorks() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="pb-sec-tail pt-sec"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          eyebrow="How it works"
          heading="Two steps, then it's automatic"
          deck={
            <>
              One line in your config and one sign-in. After that, <BrandName /> comes up with every
              session. Your agent looks whenever it needs to. You never touch it again.
            </>
          }
        />

        <div ref={ref} className={`demo-loop relative mt-group ${inView ? 'is-live' : ''}`}>
          {/* One rule for the whole sequence, behind the numbers. */}
          <span
            aria-hidden="true"
            className="hiw-rule absolute bottom-2 left-[9px] top-2 w-px bg-rule-divider sm:left-[13px]"
          />

          <ol className="relative">
            {SETUP.map((s, i) => (
              <Step key={s.n} {...s} i={i} />
            ))}
          </ol>

          {/* The loop group. The bracket is a separate positioned element
              rather than a border on the list, because it has to sit OUTSIDE
              the rule and span exactly these three rows. */}
          <div className="relative">
            <span
              aria-hidden="true"
              className="hiw-bracket absolute -left-1 bottom-6 top-1 w-[9px] rounded-l-[3px] border-y border-l border-rule-structural sm:-left-2 sm:w-3"
            />
            <ol className="relative [&>li:last-child]:pb-0">
              {LOOP.map((s, i) => (
                <Step key={s.label} {...s} i={i + 2} />
              ))}
            </ol>
            <p className="hiw-loop-note mt-stack-3 pl-[54px] font-mono text-[12px] leading-none tracking-[0.02em] text-text-quaternary sm:pl-[74px]">
              ↻ every session, without you
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
