import { SectionHeader, BleedRule } from './section-header.js';

// S5 · Pricing, with the cards deleted.
//
// Two columns separated by one vertical hairline. No border, no fill, no
// per-column button — round 5 removes bounding boxes from the whole page and
// pricing is where the temptation to keep them is strongest. Containment
// isn't functional here: there are two plans, and a rule between them is
// enough to say so.
//
// The price is --text-primary, NOT --accent. Accent is reserved for CTAs and
// interactive state; a violet price is decorative use of a semantic token,
// which is what the previous version did.
//
// Real values from @ocular/shared's plans.ts — the single source of truth
// that dashboard checkout and worker rung-gating both read from. No hidden
// tiers, no invented numbers (brand-identity.md §5). Copy says "web requests"
// and "pages that block automated browsers", never "stealth ladder"/"rungs":
// internal mechanism names stay out of customer-facing copy.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001';

const PLANS = [
  {
    label: 'Basic',
    monthly: 2.5,
    annual: 25,
    lines: [
      'Unlimited captures of your own dev server',
      '40 open-web requests a day',
      'Motion capture on both',
    ],
  },
  {
    label: 'Pro',
    monthly: 20,
    annual: 180,
    lines: [
      'Everything in Basic',
      '150 open-web requests a day',
      'Deeper reach into pages that block automated browsers',
    ],
  },
] as const;

export function Pricing() {
  return (
    <>
      <BleedRule />
      <section
        id="pricing"
        className="pb-sec-sm pt-sec-lg"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <SectionHeader
            eyebrow="Pricing"
            heading="From $2.50 a month"
            deck="Your own dev server is unmetered on every plan — it's your machine doing the work, so there's nothing for us to meter. The daily allowance is for the open web, where each render costs a real amount of money."
          />

          <div className="mt-[112px] grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-0">
            {PLANS.map((plan, i) => (
              <div
                key={plan.label}
                className={i === 1 ? 'md:border-l md:border-rule-divider md:pl-12' : 'md:pr-12'}
              >
                <p className="font-mono text-[13px] uppercase leading-none tracking-[0.08em] text-text-quaternary">
                  {plan.label}
                </p>
                <p className="mt-6 font-mono text-[40px] font-medium leading-none tracking-[-0.02em] text-text-primary">
                  {/* toFixed(2), or 2.5 renders as "$2.5" — a price missing
                      its cents reads as a typo on the one number the page
                      most needs to look deliberate. */}
                  ${plan.monthly.toFixed(2)}
                  <span className="ml-2 align-middle font-sans text-[15px] font-normal tracking-normal text-text-quaternary">
                    /mo
                  </span>
                </p>
                <p className="mt-3 font-mono text-[11.5px] leading-none tracking-[0.02em] text-text-quaternary">
                  or ${plan.annual}/year
                </p>
                <div className="mt-8 divide-y divide-rule-divider border-t border-rule-divider">
                  {plan.lines.map((line) => (
                    <p key={line} className="py-3.5 text-[15px] leading-[1.5] text-text-secondary">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <a
              href={DASHBOARD_URL}
              className="inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] text-[13.5px] font-semibold tracking-[-0.005em] text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
            >
              Choose a plan
            </a>
          </div>

          {/* The charge policy, stated plainly. Matches
              docs/rules/11-billing-and-quota.md §1 exactly. */}
          <p className="mt-10 font-mono text-[11.5px] leading-[1.7] tracking-[0.02em] text-text-quaternary">
            A clean render costs one. A render that comes back empty after every approach has been
            tried costs half. An error costs nothing.
          </p>
          <p className="mt-6 max-w-[64ch] text-[15px] leading-[1.6] text-text-tertiary [text-wrap:pretty]">
            Basic clears most of the open web, not all of it. If your work is mostly against sites
            with serious bot defences, that&rsquo;s what Pro is for — and if it&rsquo;s mostly your
            own dev server, Basic&rsquo;s cap will never come up.
          </p>
        </div>
      </section>
    </>
  );
}
