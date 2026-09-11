'use client';

import { useState } from 'react';

// NOTHING is imported from @ocular/shared here, deliberately. This is a client
// component, and that package's barrel reaches node:crypto through
// cache-key.ts -- importing a single constant from it drags a Node built-in
// into the browser bundle and fails the build outright. The server page reads
// the constants and hands them down as plain data, which is also the correct
// direction of travel: prices belong to the server that charges them.
type PlanCycle = 'monthly' | 'annual';
type PlanTier = 'basic' | 'pro';

export interface PlanOption {
  tier: PlanTier;
  label: string;
  monthly: number;
  annual: number;
  dailyWebCaptures: number;
  reach: string;
}

// A COMPARISON STRIP, not two cards.
//
// The old chooser rendered two bordered cards each carrying two outline pill
// buttons: four competing calls to action, no default, and no way to compare
// the tiers against each other because the numbers sat in prose blurbs. Two
// columns separated by a rule -- the website's own pricing pattern -- lets the
// rows line up so the difference is readable at a glance.
//
// The cycle is a toggle rather than a second pair of buttons, which halves the
// decision: pick how you pay, then pick what you get.

// Computed per tier from the real prices, never a generic badge: Basic annual
// is $25 against $30 (two months free) while Pro annual is $180 against $240
// (three). One "2 months free" badge across both would be false on one of them.
function monthsFree(plan: PlanOption): number {
  return Math.round((plan.monthly * 12 - plan.annual) / plan.monthly);
}

export function PlanChooser({
  plans,
  currentTier,
}: {
  plans: PlanOption[];
  currentTier: PlanTier | null;
}) {
  const [cycle, setCycle] = useState<PlanCycle>('monthly');

  return (
    <section>
      <div className="flex items-center gap-6">
        {(['monthly', 'annual'] as PlanCycle[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            className={`relative font-mono text-[12px] transition-colors duration-fast ease-base ${
              cycle === c ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {c === 'monthly' ? 'Monthly' : 'Annual'}
            <span
              aria-hidden
              className={`absolute -bottom-2 left-0 h-px w-full origin-left bg-accent transition-transform duration-fast ease-base ${
                cycle === c ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-12 border-y border-rule-structural py-8 sm:grid-cols-2 sm:gap-16 sm:divide-x sm:divide-rule-divider">
        {plans.map((plan) => {
          const { tier, label } = plan;
          const price = cycle === 'monthly' ? plan.monthly : plan.annual;
          const free = monthsFree(plan);

          return (
            <div key={tier} className="sm:first:pr-8 sm:last:pl-8">
              <p className="font-mono text-[13px] text-text-primary">{label}</p>

              <p className="mt-stack-2 font-mono text-[40px] font-medium leading-none tracking-[-0.02em] text-accent tabular">
                ${price}
                <span className="text-[20px] text-text-secondary">
                  {cycle === 'monthly' ? '/mo' : '/yr'}
                </span>
              </p>

              {cycle === 'annual' && (
                <p className="mt-stack-1 font-mono text-[11.5px] text-text-tertiary">
                  {free} month{free === 1 ? '' : 's'} free
                </p>
              )}

              <dl className="mt-stack-3 divide-y divide-rule-divider border-y border-rule-divider text-[15px] text-text-secondary">
                <div className="py-3">Unlimited captures on your own machine</div>
                <div className="py-3">{plan.dailyWebCaptures} web captures a day</div>
                <div className="py-3">{plan.reach}</div>
              </dl>

              <a
                href={`/billing/checkout?tier=${tier}&cycle=${cycle}`}
                className="mt-stack-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-accent px-4 font-brand text-[13px] font-semibold text-surface-base transition-[background-color,transform] duration-150 ease-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
              >
                {currentTier === tier ? 'Keep ' : ''}
                {label} — ${price}
              </a>
            </div>
          );
        })}
      </div>

      {/* The base-tier honesty line, per CLAUDE.md: never imply every site is
          reachable. */}
      <p className="mt-stack-3 max-w-[66ch] text-[15px] text-text-tertiary">
        Some sites work hard to keep automated visitors out. Basic clears most of them, not all —
        and no plan here promises every page on the web.
      </p>
    </section>
  );
}
