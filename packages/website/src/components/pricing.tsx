import { BentoCell, BentoGrid } from './bento-grid.js';
import { MotionCta } from './motion-cta.js';
import { ScrollReveal } from './scroll-reveal.js';

// Default matches packages/dashboard's local dev port (3001) — mcp-server
// already claims 3000. Production deploys set VITE_DASHBOARD_URL to the real
// dashboard domain via the build environment.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001';

// Real values from packages/shared/src/constants.ts — MONTHLY_QUOTA=300,
// SUCCESS_CHARGE=1.0, EXHAUSTED_FAILURE_CHARGE=0.5. No hidden tiers, no
// invented numbers, per brand-identity.md §5's design-ethics constraint.
export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <h2 className="mb-10 text-display-md font-bold text-text-primary">Pricing</h2>
      <BentoGrid>
        <ScrollReveal index={0} className="col-span-2 md:col-span-4 lg:col-span-8">
          <BentoCell span="hero" className="h-full">
            <p className="font-mono text-5xl font-bold text-accent">$1</p>
            <p className="mt-1 text-text-secondary">per month, 300 renders included</p>
            <ul className="mt-6 space-y-2 text-text-secondary">
              <li>Full charge only on a clean, successful render.</li>
              <li>Half charge if it doesn't come through.</li>
              <li>Nothing charged on a render error.</li>
            </ul>
            <MotionCta
              href={`${DASHBOARD_URL}/login`}
              className="mt-8 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-surface-base transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Connect Ocular
            </MotionCta>
          </BentoCell>
        </ScrollReveal>
        <ScrollReveal index={1} className="col-span-2 md:col-span-2 lg:col-span-4">
          <BentoCell span="third" className="h-full">
            <p className="font-mono text-3xl font-bold text-text-primary">300</p>
            <p className="mt-2 text-text-secondary">renders / month</p>
          </BentoCell>
        </ScrollReveal>
      </BentoGrid>
    </section>
  );
}
