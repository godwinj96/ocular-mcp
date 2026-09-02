import { BentoCell, BentoGrid } from './bento-grid.js';
import { MotionCta } from './motion-cta.js';
import { ScrollReveal } from './scroll-reveal.js';

// Default matches packages/dashboard's local dev port (3001) — mcp-server
// already claims 3000. Production deploys set VITE_DASHBOARD_URL to the real
// dashboard domain via the build environment.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001';

// Real values from @ocular/shared's plans.ts — the single source of truth
// dashboard's checkout and worker's rung-gating both read from too. No
// hidden tiers, no invented numbers, per brand-identity.md §5's
// design-ethics constraint.
//
// Two-tier model (Basic/Pro x Monthly/Annual) replaced the old flat $2.50/mo
// plan 2026-09-01 (Session 26) — Pro exists specifically to unlock the
// expensive stealth-ladder rungs (camoufox, paid unblocker), which is why
// its price step is larger than Basic's quota bump alone would suggest.
const PLANS: Array<{
  tier: 'basic' | 'pro';
  label: string;
  quota: number;
  rungs: string;
  monthly: number;
  annual: number;
}> = [
  {
    tier: 'basic',
    label: 'Basic',
    quota: 40,
    rungs: 'proxy + residential proxy',
    monthly: 2.5,
    annual: 25,
  },
  { tier: 'pro', label: 'Pro', quota: 150, rungs: 'full stealth ladder', monthly: 20, annual: 180 },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <h2 className="mb-10 text-display-md font-bold text-text-primary">Pricing</h2>
      <BentoGrid>
        {PLANS.map((plan, index) => (
          <ScrollReveal
            key={plan.tier}
            index={index}
            className="col-span-2 md:col-span-3 lg:col-span-6"
          >
            <BentoCell span="hero" className="h-full">
              <p className="font-mono text-2xl font-semibold text-text-primary">{plan.label}</p>
              <p className="mt-2 font-mono text-5xl font-bold text-accent">${plan.monthly}</p>
              <p className="mt-1 text-text-secondary">
                per month (${plan.annual}/yr) — unlimited local captures, plus {plan.quota} cloud
                renders/day
              </p>
              <ul className="mt-6 space-y-2 text-text-secondary">
                <li>Your dev server and localhost: unmetered, always.</li>
                <li>Stealth ladder: {plan.rungs}.</li>
                <li>
                  Full charge on a clean render, half if it doesn't come through, nothing on error.
                </li>
              </ul>
              <MotionCta
                href={`${DASHBOARD_URL}/login`}
                className="mt-8 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-surface-base transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Connect Ocular
              </MotionCta>
            </BentoCell>
          </ScrollReveal>
        ))}
      </BentoGrid>
    </section>
  );
}
