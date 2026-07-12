import { ScrollReveal } from './scroll-reveal.js';

// Answers the JTBD Anxiety force directly (brand-identity.md §2) instead of
// avoiding it — security, blocking, cost predictability.
const FAQS = [
  {
    q: 'Is this secure?',
    a: 'Every request goes through resolve-time and per-redirect-hop SSRF checks that block private, loopback, and cloud-metadata IP ranges before any render happens.',
  },
  {
    q: 'What happens if a site blocks the request?',
    a: 'You get a clear failure response and a half-charge — never a silent hang, never a full charge for nothing.',
  },
  {
    q: 'Will the bill surprise me?',
    a: 'No. $1/mo covers 300 renders. Full charge only on success, half on an exhausted failure, nothing on error — no metered surprises.',
  },
  {
    q: 'Do you support authenticated or cookie-based browsing?',
    a: 'Not yet — that needs its own threat model and is explicitly out of scope for this phase.',
  },
] as const;

export function Faq() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <h2 className="mb-10 text-display-md font-bold text-text-primary">FAQ</h2>
      <dl className="max-w-measure space-y-8">
        {FAQS.map((item, index) => (
          <ScrollReveal key={item.q} index={index}>
            <dt className="text-lg font-semibold text-text-primary">{item.q}</dt>
            <dd className="mt-2 text-text-secondary">{item.a}</dd>
          </ScrollReveal>
        ))}
      </dl>
    </section>
  );
}
