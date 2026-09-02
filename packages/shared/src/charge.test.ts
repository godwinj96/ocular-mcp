import { describe, expect, it } from 'vitest';
import { chargeForEnvelope, MAX_RESERVE_CHARGE } from './charge.js';
import { EXHAUSTED_FAILURE_CHARGE, RUNG_CHARGE_MULTIPLIERS, SUCCESS_CHARGE } from './constants.js';
import type { FailureEnvelope, SuccessEnvelope } from './errors.js';

function success(rungReached = 0): SuccessEnvelope {
  return { ok: true, meta: { requestId: 'r1', rungReached, durationMs: 100 } };
}

function failure(reason: FailureEnvelope['reason'], rungReached: number): FailureEnvelope {
  return { ok: false, reason, message: 'x', rungReached };
}

describe('chargeForEnvelope', () => {
  it('charges SUCCESS_CHARGE for a clean rung-0 render (multiplier 1x)', () => {
    expect(chargeForEnvelope(success(0))).toBe(SUCCESS_CHARGE);
  });

  it('multiplies SUCCESS_CHARGE by the reached rung per RUNG_CHARGE_MULTIPLIERS', () => {
    expect(chargeForEnvelope(success(1))).toBe(SUCCESS_CHARGE * RUNG_CHARGE_MULTIPLIERS[1]);
    expect(chargeForEnvelope(success(2))).toBe(SUCCESS_CHARGE * RUNG_CHARGE_MULTIPLIERS[2]);
    expect(chargeForEnvelope(success(3))).toBe(SUCCESS_CHARGE * RUNG_CHARGE_MULTIPLIERS[3]);
  });

  it('falls back to the highest known multiplier for an out-of-range rung', () => {
    const highest = Math.max(...Object.values(RUNG_CHARGE_MULTIPLIERS));
    expect(chargeForEnvelope(success(99))).toBe(SUCCESS_CHARGE * highest);
  });

  it('a cache hit is always free, regardless of outcome', () => {
    expect(chargeForEnvelope(success(3), { cacheHit: true })).toBe(0);
    expect(chargeForEnvelope(failure('BLOCKED', 2), { cacheHit: true })).toBe(0);
  });

  it('MAX_RESERVE_CHARGE equals SUCCESS_CHARGE at the most expensive rung multiplier', () => {
    expect(MAX_RESERVE_CHARGE).toBe(
      SUCCESS_CHARGE * Math.max(...Object.values(RUNG_CHARGE_MULTIPLIERS)),
    );
  });

  it.each(['BLOCKED', 'UPSTREAM_4XX', 'UPSTREAM_5XX', 'BUDGET_EXHAUSTED'] as const)(
    'charges half (rung-multiplied) for %s unconditionally, even with rungReached 0',
    (reason) => {
      expect(chargeForEnvelope(failure(reason, 0))).toBe(
        EXHAUSTED_FAILURE_CHARGE * RUNG_CHARGE_MULTIPLIERS[0],
      );
      expect(chargeForEnvelope(failure(reason, 2))).toBe(
        EXHAUSTED_FAILURE_CHARGE * RUNG_CHARGE_MULTIPLIERS[2],
      );
    },
  );

  it.each(['TIMEOUT', 'RENDER_ERROR'] as const)(
    'charges half (rung-multiplied) for %s only when a rung was attempted, none otherwise',
    (reason) => {
      expect(chargeForEnvelope(failure(reason, 0))).toBe(0);
      expect(chargeForEnvelope(failure(reason, 1))).toBe(
        EXHAUSTED_FAILURE_CHARGE * RUNG_CHARGE_MULTIPLIERS[1],
      );
    },
  );

  it('charges nothing for SSRF_BLOCKED even if it reaches the worker layer', () => {
    expect(chargeForEnvelope(failure('SSRF_BLOCKED', 0))).toBe(0);
  });

  it('charges nothing for pre-enqueue-shaped reasons (defensive — should never actually reach worker)', () => {
    expect(chargeForEnvelope(failure('UNAUTHORIZED', 0))).toBe(0);
    expect(chargeForEnvelope(failure('INVALID_URL', 0))).toBe(0);
    expect(chargeForEnvelope(failure('QUOTA_EXCEEDED', 0))).toBe(0);
    expect(chargeForEnvelope(failure('RATE_LIMITED', 0))).toBe(0);
  });
});
