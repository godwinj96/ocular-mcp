/**
 * Actual-charge derivation from a resolved ResultEnvelope — the single
 * source of truth for docs/rules/09-error-handling-and-logging.md §1's
 * charge table. Used by `worker` to reconcile the pre-enqueue quota
 * reservation (see docs/rules/11-billing-and-quota.md §2) against what the
 * job actually earned. A pre-enqueue rejection (UNAUTHORIZED, INVALID_URL,
 * SSRF_BLOCKED at the mcp-server precheck layer, QUOTA_EXCEEDED) never
 * reaches this function — those never enqueue a job in the first place.
 */

import { EXHAUSTED_FAILURE_CHARGE, SUCCESS_CHARGE } from './constants.js';
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

export function chargeForEnvelope(envelope: ResultEnvelope): number {
  if (envelope.ok) {
    return SUCCESS_CHARGE;
  }

  if (UNCONDITIONAL_HALF_CHARGE.has(envelope.reason)) {
    return EXHAUSTED_FAILURE_CHARGE;
  }

  if (CONDITIONAL_HALF_CHARGE.has(envelope.reason)) {
    return envelope.rungReached > 0 ? EXHAUSTED_FAILURE_CHARGE : 0;
  }

  // SSRF_BLOCKED reaching here means the worker's own authoritative check
  // (docs/rules/07-security.md §2's second layer) rejected it — still no
  // charge, same as the mcp-server precheck layer catching it earlier.
  return 0;
}
