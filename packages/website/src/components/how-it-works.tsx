import { HairlineRow } from './hairline-row.js';
import { ScrollReveal } from './scroll-reveal.js';
import { IconFrames, IconGlobe, IconNoAction, IconScan } from './wireframe-icons.js';

// Copy rewritten to convey capability without naming mechanism — the
// founder's "magic, mechanism hidden" positioning. The previous version
// leaked it repeatedly: "the DOM", "stills", "screenshots paired with an
// annotated accessibility tree", "sampled as frames". Each row now describes
// what the reader gets, told through their own bug list rather than through
// the implementation's contrast class.
//
// Row order follows the objection order this buyer actually has:
// efficacy first, then reach, then the safety boundary. The read-only row was
// previously buried at the bottom of this section — below the point where
// that doubt has already cost the visit.
const CAPABILITIES = [
  {
    title: 'It sees what actually rendered',
    description:
      'Canvas, WebGL, a layout that only breaks at 1280 — the failures your agent cannot reason its way to from the code.',
    icon: <IconScan />,
  },
  {
    title: 'It sees things move',
    description: 'Animation, transitions, and scroll-driven UI — not just where they end up.',
    icon: <IconFrames />,
  },
  {
    title: 'Your dev server, and the open web',
    description:
      'Localhost is unmetered — it’s your machine doing the work. Public pages go through Ocular, within a daily allowance.',
    icon: <IconGlobe />,
  },
  {
    title: 'It can look. It can’t act.',
    description:
      'No clicking, no typing, no navigation side effects. Ocular cannot act on your browser — that boundary is the product, not a setting.',
    icon: <IconNoAction />,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      className="py-32 md:pb-32 md:pt-40"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <h2 className="mb-12 max-w-[22ch] text-[clamp(1.5rem,1.3rem+0.8vw,1.875rem)] font-semibold leading-[1.2] tracking-[-0.02em] text-text-primary [text-wrap:balance]">
          What your agent gets
        </h2>
        <div className="max-w-[760px]">
          {CAPABILITIES.map((capability, index) => (
            <ScrollReveal key={capability.title} index={index}>
              <HairlineRow leading={capability.icon} title={capability.title}>
                {capability.description}
              </HairlineRow>
            </ScrollReveal>
          ))}
        </div>

        {/* Volunteering the limitation is worth more to this audience than any
            claim that could replace it — and it keeps the page inside the
            guardrail that read-only removes action risk, not exfiltration or
            prompt-injection risk. */}
        <p className="mt-12 max-w-[68ch] text-[15.5px] leading-[1.6] tracking-[-0.003em] text-text-tertiary [text-wrap:pretty]">
          Ocular is new, and built by one developer. What it does is deliberately narrow: it can
          look at a page, and it cannot act on one. Localhost captures render on your machine. It
          doesn’t make what your agent reads safe — captured content still enters its context, like
          anything else it reads from the web.
        </p>
      </div>
    </section>
  );
}
