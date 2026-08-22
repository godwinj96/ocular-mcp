import { describe, expect, it } from 'vitest';
import { chargeForEnvelope } from './charge.js';
import { EXHAUSTED_FAILURE_CHARGE, SUCCESS_CHARGE } from './constants.js';
import type { FailureEnvelope, SuccessEnvelope } from './errors.js';

function success(): SuccessEnvelope {
  return { ok: true, meta: { requestId: 'r1', rungReached: 1, durationMs: 100 } };
}

function failure(reason: FailureEnvelope['reason'], rungReached: number): FailureEnvelope {
  return { ok: false, reason, message: 'x', rungReached };
}

describe('chargeForEnvelope', () => {
  it('charges SUCCESS_CHARGE for a successful render', () => {
    expect(chargeForEnvelope(success())).toBe(SUCCESS_CHARGE);
  });

  it.each(['BLOCKED', 'UPSTREAM_4XX', 'UPSTREAM_5XX', 'BUDGET_EXHAUSTED'] as const)(
    'charges half for %s unconditionally, even with rungReached 0',
    (reason) => {
      expect(chargeForEnvelope(failure(reason, 0))).toBe(EXHAUSTED_FAILURE_CHARGE);
      expect(chargeForEnvelope(failure(reason, 2))).toBe(EXHAUSTED_FAILURE_CHARGE);
    },
  );

  it.each(['TIMEOUT', 'RENDER_ERROR'] as const)(
    'charges half for %s only when a rung was attempted, none otherwise',
    (reason) => {
      expect(chargeForEnvelope(failure(reason, 0))).toBe(0);
      expect(chargeForEnvelope(failure(reason, 1))).toBe(EXHAUSTED_FAILURE_CHARGE);
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
