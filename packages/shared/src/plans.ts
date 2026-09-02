/**
 * Two-tier billing model — Basic / Pro, each Monthly / Annual. Introduced
 * 2026-09-01 (Session 26) replacing the old single flat-plan model. See
 * docs/rules/11-billing-and-quota.md and packages/dashboard/lib/bachs.ts for
 * where these slugs originate (Bachs product IDs) and terminate (Postgres
 * accounts.plan column, a free-text slug per infra/postgres/migrations/0001_init.sql).
 */

export type PlanTier = 'basic' | 'pro';
export type PlanCycle = 'monthly' | 'annual';

export type PlanSlug = 'basic_monthly' | 'basic_annual' | 'pro_monthly' | 'pro_annual';

export const PLAN_SLUGS: readonly PlanSlug[] = [
  'basic_monthly',
  'basic_annual',
  'pro_monthly',
  'pro_annual',
];

export function planSlug(tier: PlanTier, cycle: PlanCycle): PlanSlug {
  return `${tier}_${cycle}`;
}

/** Reverse of planSlug — the tier half of a stored/webhook-derived plan slug. Unknown/null input (never subscribed, or a not-yet-recognized slug) returns null; callers must not assume a default tier. */
export function tierOfPlanSlug(slug: string | null | undefined): PlanTier | null {
  if (slug === 'basic_monthly' || slug === 'basic_annual') return 'basic';
  if (slug === 'pro_monthly' || slug === 'pro_annual') return 'pro';
  return null;
}

export function cycleOfPlanSlug(slug: string | null | undefined): PlanCycle | null {
  if (slug === 'basic_monthly' || slug === 'pro_monthly') return 'monthly';
  if (slug === 'basic_annual' || slug === 'pro_annual') return 'annual';
  return null;
}

/**
 * List prices, in whole USD. Source of truth for pricing copy on the website
 * and dashboard — do not hardcode these numbers elsewhere. PROVISIONAL in
 * the sense every dollar figure in this file is: founder-set, not derived.
 */
export const PLAN_PRICE_USD: Record<PlanSlug, number> = {
  basic_monthly: 2.5,
  basic_annual: 25,
  pro_monthly: 20,
  pro_annual: 180,
};

/**
 * Daily cloud-render cap by plan tier. Basic inherits the pre-tiering
 * DAILY_CLOUD_QUOTA value (PRD's 30-50/day range); Pro is extrapolated
 * (~3.75x Basic) pending real usage data — same "provisional, revisit
 * post-launch" status the old single-tier value carried.
 */
export const DAILY_CLOUD_QUOTA_BY_TIER: Record<PlanTier, number> = {
  basic: 40,
  pro: 150,
};

/**
 * Highest stealth-ladder rung index (packages/worker/src/ladder/rung-profiles.ts's
 * RUNG_NAMES: 0=dc-proxy, 1=residential-proxy, 2=camoufox, 3=paid-unblocker)
 * a plan tier may escalate to, inclusive. Basic gets the two cheap rungs;
 * Pro unlocks camoufox + the paid unblocker, which is why Pro costs more.
 */
export const MAX_RUNG_INDEX_BY_TIER: Record<PlanTier, number> = {
  basic: 1,
  pro: 3,
};
