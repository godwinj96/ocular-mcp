import { describe, expect, it } from 'vitest';
import { errorCodeSchema, type FailureEnvelope, type SuccessEnvelope } from './errors.js';

describe('errorCodeSchema', () => {
  const validCodes = [
    'BLOCKED',
    'TIMEOUT',
    'INVALID_URL',
    'SSRF_BLOCKED',
    'QUOTA_EXCEEDED',
    'UPSTREAM_4XX',
    'UPSTREAM_5XX',
    'RENDER_ERROR',
    'BUDGET_EXHAUSTED',
    'UNAUTHORIZED',
  ] as const;

  it.each(validCodes)('accepts %s', (code) => {
    expect(errorCodeSchema.parse(code)).toBe(code);
  });

  it('rejects an unknown code', () => {
    expect(() => errorCodeSchema.parse('NOT_A_REAL_CODE')).toThrow();
  });

  it('rejects a lowercase variant of a valid code', () => {
    expect(() => errorCodeSchema.parse('blocked')).toThrow();
  });
});

describe('ResultEnvelope shape', () => {
  it('a success envelope satisfies SuccessEnvelope', () => {
    const envelope: SuccessEnvelope<{ tokens: string[] }> = {
      ok: true,
      meta: { requestId: 'req_1', rungReached: 0, durationMs: 1200 },
      image: { b64: 'aGVsbG8=', mime: 'image/webp', w: 800, h: 600, bytes: 1024 },
      data: { tokens: ['#fff'] },
    };
    expect(envelope.ok).toBe(true);
  });

  it('a failure envelope satisfies FailureEnvelope', () => {
    const envelope: FailureEnvelope = {
      ok: false,
      reason: 'BLOCKED',
      message: 'This site blocked automated access after trying multiple approaches.',
      rungReached: 2,
    };
    expect(envelope.ok).toBe(false);
    expect(errorCodeSchema.parse(envelope.reason)).toBe('BLOCKED');
  });
});
