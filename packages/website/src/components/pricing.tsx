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
// plan 2026-09-01 (Session 26) — Pro exists specifically to unlock deeper
// reach into pages that block simple scrapers, which is why its price step
// is larger than Basic's quota bump alone would suggest. Copy deliberately
// says "web requests," never "stealth ladder"/"rungs" — internal mechanism
// names stay out of customer-facing copy (see feedback_website_copy_and_
// positioning memory).
const PLANS: Array<{
  tier: 'basic' | 'pro';
  label: string;
  quota: number;
  reach: string;
  monthly: number;
  annual: number;
}> = [
  {
    tier: 'basic',
    label: 'Basic',
    quota: 40,
    reach: 'web requests a day',
    monthly: 2.5,
    annual: 25,
  },
  {
    tier: 'pro',
    label: 'Pro',
    quota: 150,
    reach: 'web requests a day, with extra reach into pages that block simple scrapers',
    monthly: 20,
    annual: 180,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <h2 className="mb-10 text-[clamp(1.5rem,1.3rem+0.8vw,1.875rem)] font-semibold leading-[1.2] tracking-[-0.02em] text-text-primary">
        Pricing
      </h2>
      <BentoGrid>
        {PLANS.map((plan, index) => (
          <ScrollReveal
            key={plan.tier}
            index={index}
            className="col-span-2 md:col-span-3 lg:col-span-6"
          >
            <BentoCell span="hero" className="h-full">
              <p className="font-mono text-2xl font-semibold text-text-primary">{plan.label}</p>
              <p className="mt-2 font-mono text-5xl font-bold text-accent">
                ${plan.monthly.toFixed(2)}
              </p>
              <p className="mt-1 text-text-secondary">
                per month (${plan.annual}/yr) — unlimited localhost requests, plus {plan.quota}{' '}
                {plan.reach}
              </p>
              <ul className="mt-6 space-y-2 text-text-secondary">
                <li>Your dev server and localhost: unmetered, always.</li>
                <li>
                  Full charge on a clean render, half if it doesn't come through, nothing on error.
                </li>
              </ul>
              <MotionCta
                href={`${DASHBOARD_URL}/login`}
                className="mt-8 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-surface-base transition-[background-color,transform] duration-150 ease-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
              >
                Connect your agent
              </MotionCta>
            </BentoCell>
          </ScrollReveal>
        ))}
      </BentoGrid>
    </section>
  );
}
