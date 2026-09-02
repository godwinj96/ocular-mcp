import { ScrollReveal } from './scroll-reveal.js';

// Answers the JTBD Anxiety force directly (brand-identity.md §2) instead of
// avoiding it — security, blocking, cost predictability.
const FAQS = [
  {
    q: 'Is this secure?',
    a: "Ocular cannot act on your browser — no clicking, typing, or navigation, read-only by design. On the public web, every request also goes through resolve-time and per-redirect-hop SSRF checks. That removes the action risk. It doesn't remove the risk of what a captured page contains: content still enters your agent's context, same as any other tool that reads the web.",
  },
  {
    q: 'What happens if a site blocks the request?',
    a: 'You get a clear failure response and a half-charge on the public-web path — never a silent hang, never a full charge for nothing. Your own dev server never fails this way, since nothing is trying to block you from it.',
  },
  {
    q: 'Will the bill surprise me?',
    a: 'No. $2.50/mo covers unlimited captures of your own localhost and dev server, plus 40 public-web renders a day. Full charge only on a clean render, half on an exhausted failure, nothing on error — no metered surprises.',
  },
  {
    q: 'Do you support authenticated or cookie-based browsing?',
    a: "On your own machine — yes, planned via a local browser profile you log into once, and that session never leaves your device. On the public web — no, and it won't: extracting or replaying someone else's session cookies is a permanently different, worse threat model.",
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
