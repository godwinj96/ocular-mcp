import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createPkcePair, createState, deriveChallenge, statesMatch } from './pkce.js';

describe('createPkcePair', () => {
  it('produces a verifier within RFC 7636 length bounds', () => {
    const { verifier } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('produces a verifier using only the RFC 7636 unreserved character set', () => {
    // If this ever fails, the verifier would need percent-encoding on the
    // wire and the token exchange would silently mismatch.
    for (let i = 0; i < 50; i++) {
      expect(createPkcePair().verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it('never repeats a verifier across calls', () => {
    const seen = new Set(Array.from({ length: 200 }, () => createPkcePair().verifier));
    expect(seen.size).toBe(200);
  });

  it('always declares the S256 method, never plain', () => {
    expect(createPkcePair().method).toBe('S256');
  });

  it('derives the challenge as base64url(SHA256(verifier))', () => {
    const { verifier, challenge } = createPkcePair();
    const expected = createHash('sha256').update(verifier, 'ascii').digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('produces a challenge that is not the verifier — the verifier must not leak', () => {
    const { verifier, challenge } = createPkcePair();
    expect(challenge).not.toBe(verifier);
  });
});

describe('deriveChallenge', () => {
  it('matches the RFC 7636 appendix B test vector', () => {
    // RFC 7636 Appendix B: this exact verifier must produce this challenge.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(deriveChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('is deterministic', () => {
    expect(deriveChallenge('abc123')).toBe(deriveChallenge('abc123'));
  });
});

describe('createState', () => {
  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 200 }, () => createState()));
    expect(seen.size).toBe(200);
  });
});

describe('statesMatch', () => {
  it('accepts an exact match', () => {
    const state = createState();
    expect(statesMatch(state, state)).toBe(true);
  });

  it('rejects a different value of the same length', () => {
    expect(statesMatch('a'.repeat(43), 'b'.repeat(43))).toBe(false);
  });

  it('rejects a length mismatch without throwing', () => {
    // timingSafeEqual throws on unequal lengths; the guard must catch that
    // before it reaches the comparison.
    expect(() => statesMatch('short', 'muchlongervalue')).not.toThrow();
    expect(statesMatch('short', 'muchlongervalue')).toBe(false);
  });

  it('rejects undefined and null — a callback with no state param is not a match', () => {
    expect(statesMatch('expected', undefined)).toBe(false);
    expect(statesMatch('expected', null)).toBe(false);
  });

  it('rejects an empty received state against a real one', () => {
    expect(statesMatch(createState(), '')).toBe(false);
  });
});
