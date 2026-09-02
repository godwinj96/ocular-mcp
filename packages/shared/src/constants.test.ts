import { describe, expect, it } from 'vitest';
import {
  CACHE_TTL_STABLE_S,
  CACHE_TTL_STANDARD_S,
  CACHE_TTL_VOLATILE_S,
  DETAIL_MAX_EDGE_PX,
  EXHAUSTED_FAILURE_CHARGE,
  IMG_MAX_EDGE_PX,
  JOB_DEADLINE_MS,
  LOCAL_IDLE_SHUTDOWN_MIN,
  LOCAL_SUBSCRIPTION_GRACE_HOURS,
  RUNG_CHARGE_MULTIPLIERS,
  SERVER_AWAIT_MS,
  SUCCESS_CHARGE,
} from './constants.js';
import { DAILY_CLOUD_QUOTA_BY_TIER } from './plans.js';

describe('constants', () => {
  it('SERVER_AWAIT_MS is greater than JOB_DEADLINE_MS, per docs/rules/03-shared-contracts.md §3', () => {
    expect(SERVER_AWAIT_MS).toBeGreaterThan(JOB_DEADLINE_MS);
  });

  it('EXHAUSTED_FAILURE_CHARGE is a fraction of SUCCESS_CHARGE, per the half-charge policy', () => {
    expect(EXHAUSTED_FAILURE_CHARGE).toBe(SUCCESS_CHARGE / 2);
  });

  it('DETAIL_MAX_EDGE_PX.balanced matches IMG_MAX_EDGE_PX', () => {
    expect(DETAIL_MAX_EDGE_PX.balanced).toBe(IMG_MAX_EDGE_PX);
  });

  it('DETAIL_MAX_EDGE_PX is ordered low < balanced < high', () => {
    expect(DETAIL_MAX_EDGE_PX.low).toBeLessThan(DETAIL_MAX_EDGE_PX.balanced);
    expect(DETAIL_MAX_EDGE_PX.balanced).toBeLessThan(DETAIL_MAX_EDGE_PX.high);
  });

  it('DAILY_CLOUD_QUOTA_BY_TIER.basic falls within the PRD-specified 30-50/day range', () => {
    expect(DAILY_CLOUD_QUOTA_BY_TIER.basic).toBeGreaterThanOrEqual(30);
    expect(DAILY_CLOUD_QUOTA_BY_TIER.basic).toBeLessThanOrEqual(50);
  });

  it('DAILY_CLOUD_QUOTA_BY_TIER.pro is greater than basic — Pro is strictly more capable', () => {
    expect(DAILY_CLOUD_QUOTA_BY_TIER.pro).toBeGreaterThan(DAILY_CLOUD_QUOTA_BY_TIER.basic);
  });

  it('RUNG_CHARGE_MULTIPLIERS is non-decreasing across rungs 0-3 (escalation never gets cheaper)', () => {
    expect(RUNG_CHARGE_MULTIPLIERS[0]).toBeLessThanOrEqual(RUNG_CHARGE_MULTIPLIERS[1]);
    expect(RUNG_CHARGE_MULTIPLIERS[1]).toBeLessThanOrEqual(RUNG_CHARGE_MULTIPLIERS[2]);
    expect(RUNG_CHARGE_MULTIPLIERS[2]).toBeLessThanOrEqual(RUNG_CHARGE_MULTIPLIERS[3]);
  });

  it('RUNG_CHARGE_MULTIPLIERS[0] is 1x — a clean rung-0 render costs exactly SUCCESS_CHARGE', () => {
    expect(RUNG_CHARGE_MULTIPLIERS[0]).toBe(1);
  });

  it('CACHE_TTL tiers are ordered volatile < standard < stable', () => {
    expect(CACHE_TTL_VOLATILE_S).toBeLessThan(CACHE_TTL_STANDARD_S);
    expect(CACHE_TTL_STANDARD_S).toBeLessThan(CACHE_TTL_STABLE_S);
  });

  it('LOCAL_IDLE_SHUTDOWN_MIN and LOCAL_SUBSCRIPTION_GRACE_HOURS are positive', () => {
    expect(LOCAL_IDLE_SHUTDOWN_MIN).toBeGreaterThan(0);
    expect(LOCAL_SUBSCRIPTION_GRACE_HOURS).toBeGreaterThan(0);
  });
});
