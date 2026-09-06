/**
 * Actual-charge derivation from a resolved ResultEnvelope — the single
 * source of truth for docs/rules/09-error-handling-and-logging.md §1's
 * charge table. Used by `worker` to reconcile the pre-enqueue quota
 * reservation (see docs/rules/11-billing-and-quota.md §2) against what the
 * job actually earned. A pre-enqueue rejection (UNAUTHORIZED, INVALID_URL,
 * SSRF_BLOCKED at the mcp-server precheck layer, QUOTA_EXCEEDED) never
 * reaches this function — those never enqueue a job in the first place.
 *
 * Only applies to the CLOUD path — local-worker renders are unmetered
 * (docs/rules/11-billing-and-quota.md §0a) and never call this function.
 */

import { EXHAUSTED_FAILURE_CHARGE, RUNG_CHARGE_MULTIPLIERS, SUCCESS_CHARGE } from './constants.js';
import type { ResultEnvelope } from './errors.js';

// Reasons that always charge half, regardless of rungReached — the ladder
// necessarily attempted at least one rung to produce these outcomes.
const UNCONDITIONAL_HALF_CHARGE = new Set([
  'BLOCKED',
  'UPSTREAM_4XX',
  'UPSTREAM_5XX',
  'BUDGET_EXHAUSTED',
]);

// Reasons where the charge depends on whether a rung was actually attempted
// (rungReached > 0) — per the table's "half if a rung was attempted, none
// otherwise" language for TIMEOUT and RENDER_ERROR specifically.
const CONDITIONAL_HALF_CHARGE = new Set(['TIMEOUT', 'RENDER_ERROR']);

// Highest multiplier across all rungs — mcp-server reserves quota at this
// worst-case amount before enqueue (the actual rung isn't known yet), and
// worker's settle-quota.ts refunds the gap down to the real charge once the
// job resolves. docs/rules/11-billing-and-quota.md §2.
export const MAX_RESERVE_CHARGE =
  SUCCESS_CHARGE * Math.max(...Object.values(RUNG_CHARGE_MULTIPLIERS));

// RUNG_CHARGE_MULTIPLIERS is keyed 0-3 today; an out-of-range rung (ladder
// grows a rung later without this table being updated) falls back to the
// most expensive known multiplier rather than silently under-charging.
function rungMultiplier(rung: number): number {
  const known = RUNG_CHARGE_MULTIPLIERS as Record<number, number>;
  return known[rung] ?? Math.max(...Object.values(RUNG_CHARGE_MULTIPLIERS));
}

export interface ChargeOptions {
  /**
   * A cache hit is charged at HALF, and short-circuits every rule below.
   *
   * DECIDED 2026-09-06 by the founder, closing PRD v0.2 §9 open decision 1.
   * This file previously returned 0 ("popular pages are free"); that framing
   * is withdrawn and any copy resting on it is wrong.
   *
   * Deliberately NOT rung-multiplied. The multipliers price escalating
   * proxy/compute cost as the stealth ladder climbs, and a cache hit climbs
   * nothing — it serves a stored result. Multiplying here would charge a
   * user more for a cache hit because the ORIGINAL render happened to be
   * expensive, which is backwards: the expensive part is what already got
   * paid for.
   */
  cacheHit?: boolean;
}

export function chargeForEnvelope(envelope: ResultEnvelope, options: ChargeOptions = {}): number {
  if (options.cacheHit) {
    return EXHAUSTED_FAILURE_CHARGE;
  }

  if (envelope.ok) {
    return SUCCESS_CHARGE * rungMultiplier(envelope.meta.rungReached);
  }

  if (UNCONDITIONAL_HALF_CHARGE.has(envelope.reason)) {
    return EXHAUSTED_FAILURE_CHARGE * rungMultiplier(envelope.rungReached);
  }

  if (CONDITIONAL_HALF_CHARGE.has(envelope.reason)) {
    return envelope.rungReached > 0
      ? EXHAUSTED_FAILURE_CHARGE * rungMultiplier(envelope.rungReached)
      : 0;
  }

  // SSRF_BLOCKED reaching here means the worker's own authoritative check
  // (docs/rules/07-security.md §2's second layer) rejected it — still no
  // charge, same as the mcp-server precheck layer catching it earlier.
  return 0;
}
