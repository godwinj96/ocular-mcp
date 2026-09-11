import { SectionHeader } from './section-header';

// S5 · In practice — the section that answers "is this for me".
//
// The page proved four capabilities and never named a JOB. Capability sections
// answer "what is it"; a visitor arrives asking whether it is for them, and
// nothing on the page was answering that.
//
// WHY IT IS FIVE ROWS ON HAIRLINES AND NOT A CARD GRID. A survey of fourteen
// developer-tool home pages, run before this was designed rather than after:
//
//   - Ten of fourteen fill this slot with SOCIAL PROOF — customer logos,
//     testimonials, "trusted by". That answer is closed to us twice over:
//     06-brand-identity.md §5 excludes fabricated proof, and there is nothing
//     real to show yet. The single most common solution is unavailable, which
//     is why this needed designing instead of copying.
//   - A job LIST appears on only four of fourteen (Browserbase, Inngest,
//     Modal, Steel) and every one is a wide-surface platform whose list exists
//     to answer "which of the many uses is mine?". Ocular has one use with
//     five contexts, so a grid would disambiguate nothing and just restate the
//     four demos above it in smaller type.
//   - Narrow, single-purpose tools ship no job list at all. Warp keeps its use
//     cases in the NAV. Linear and Sentry have none.
//   - Where a narrow tool does name jobs, each job has an ARTIFACT attached —
//     Browserbase's runnable templates, Raycast's real extensions. That is why
//     tabs work for them and would fail here: we have no per-item artifact, so
//     tabs would hide four fifths of a five-line section behind a click for
//     nothing.
//
// So: no icons, no cards, no tabs, no fifth demo. The hairline row is already
// this page's grammar for exactly this shape (faq.tsx's divide-y, BleedRule,
// the how-it-works rule), and reusing it is the restraint finding applied —
// the same way the stepper survey resolved.
//
// ORDERING IS ARGUED, NOT ARBITRARY. Canvas leads because it is the one item
// that survives "I already have a screenshot script" outright: there is no
// workaround, because there is no structure to read. The open web lands last
// as the TURN — the point where the section stops being about your machine —
// which is also the claim the page most under-sells.
const CASES = [
  {
    label: 'Canvas, WebGL, and anything drawn instead of marked up',
    body: "A chart, a 3D scene, a map, a game view. The element tree can tell your agent a canvas is there. It can't tell your agent anything about what the canvas drew. There is no structure to read, only something to look at.",
  },
  {
    label: "A component that compiles but doesn't render",
    body: 'The build is green, the test passes, and the screen is empty. Your agent looks at the page it just changed and finds out in the same turn, instead of asking you.',
  },
  {
    label: "An animation that's supposed to run",
    body: 'A transition, a hover state, a scroll-driven effect. Your agent gets the sequence back as frames and can say whether it ran, and whether it ran the way you described it.',
  },
  {
    label: 'Layout that breaks at one width',
    body: 'The desktop view is fine and the 390px view is a stack of overlapping boxes. Your agent can look at both without you resizing anything or taking a screenshot.',
  },
  {
    label: 'A page on the open web that your agent needs to read',
    body: "A component in someone else's docs, a pricing table you're matching, the reference your client sent as a link. Same connection as your dev server, no second tool, no handing the job back to you.",
  },
] as const;

export function UseCases() {
  return (
    <section
      id="in-practice"
      className="pb-sec-tail pt-sec"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          eyebrow="In practice"
          heading="What your agent looks at"
          // The deck names the thread common to all five, and it is deliberately
          // true of a reader who already has a workaround — they look too. The
          // claim is not that they cannot look; it is that looking is a
          // recurring necessity, which is the setup for making it permanent.
          deck="Every one of these is a moment where the code compiles, the tests pass, and the only way to know is to look."
        />

        {/* Same grammar as faq.tsx: divide-y rows in a two-column grid. A row
            that starts describing what COMES BACK rather than what you were
            trying to find out has turned back into a capability, and the
            section has failed. */}
        <dl className="mt-group divide-y divide-rule-divider border-y border-rule-divider">
          {CASES.map((c) => (
            <div
              key={c.label}
              className="grid grid-cols-1 gap-stack-1 py-stack-3 lg:grid-cols-[320px_1fr] lg:gap-12"
            >
              <dt className="text-[19px] font-medium leading-[1.35] tracking-[-0.014em] text-text-primary [text-wrap:balance]">
                {c.label}
              </dt>
              <dd className="max-w-[62ch] text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
                {c.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
