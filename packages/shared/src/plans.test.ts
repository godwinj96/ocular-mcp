import { describe, expect, it } from 'vitest';
import {
  DAILY_CLOUD_QUOTA_BY_TIER,
  MAX_RUNG_INDEX_BY_TIER,
  PLAN_PRICE_USD,
  PLAN_SLUGS,
  cycleOfPlanSlug,
  planSlug,
  tierOfPlanSlug,
} from './plans.js';

describe('plan slug round-trip', () => {
  it('planSlug/tierOfPlanSlug/cycleOfPlanSlug agree for every combination', () => {
    for (const tier of ['basic', 'pro'] as const) {
      for (const cycle of ['monthly', 'annual'] as const) {
        const slug = planSlug(tier, cycle);
        expect(tierOfPlanSlug(slug)).toBe(tier);
        expect(cycleOfPlanSlug(slug)).toBe(cycle);
      }
    }
  });

  it('tierOfPlanSlug/cycleOfPlanSlug return null for an unrecognized or missing slug', () => {
    expect(tierOfPlanSlug('some_old_bachs_product_id')).toBeNull();
    expect(tierOfPlanSlug(null)).toBeNull();
    expect(cycleOfPlanSlug(undefined)).toBeNull();
  });

  it('PLAN_SLUGS, PLAN_PRICE_USD, DAILY_CLOUD_QUOTA_BY_TIER, and MAX_RUNG_INDEX_BY_TIER stay consistent', () => {
    for (const slug of PLAN_SLUGS) {
      expect(PLAN_PRICE_USD[slug]).toBeGreaterThan(0);
    }
    expect(DAILY_CLOUD_QUOTA_BY_TIER.pro).toBeGreaterThan(DAILY_CLOUD_QUOTA_BY_TIER.basic);
    expect(MAX_RUNG_INDEX_BY_TIER.pro).toBeGreaterThan(MAX_RUNG_INDEX_BY_TIER.basic);
  });

  it('an annual plan costs less than 12x its monthly price (a real discount, not a rounding artifact)', () => {
    expect(PLAN_PRICE_USD.basic_annual).toBeLessThan(PLAN_PRICE_USD.basic_monthly * 12);
    expect(PLAN_PRICE_USD.pro_annual).toBeLessThan(PLAN_PRICE_USD.pro_monthly * 12);
  });
});
