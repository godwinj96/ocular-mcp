// PKCE (RFC 7636) primitives for the first-run login flow. See
// docs/design/first-run-auth-and-payment.md §4.
//
// The code_verifier is the whole point of PKCE and it MUST NOT leave this
// machine: the dashboard's /connect route only ever sees the challenge (a
// SHA-256 hash), so it cannot mint tokens on the user's behalf. Only the
// token exchange in token-client.ts ever transmits the verifier.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 7636 §4.1 allows a 43-128 character verifier from the unreserved set
 * [A-Za-z0-9-._~]. base64url of 32 random bytes is exactly 43 characters and
 * uses only unreserved characters, so it needs no further escaping.
 */
const VERIFIER_BYTES = 32;
const STATE_BYTES = 32;

export interface PkcePair {
  verifier: string;
  challenge: string;
  /** Always S256. RFC 7636 also allows "plain"; we never use it. */
  method: 'S256';
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function createPkcePair(): PkcePair {
  const verifier = base64url(randomBytes(VERIFIER_BYTES));
  return { verifier, challenge: deriveChallenge(verifier), method: 'S256' };
}

/** base64url(SHA256(verifier)) — RFC 7636 §4.2. */
export function deriveChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier, 'ascii').digest());
}

/** CSPRNG state for CSRF protection on the callback (RFC 6749 §10.12). */
export function createState(): string {
  return base64url(randomBytes(STATE_BYTES));
}

/**
 * Constant-time state comparison. The timing signal here is small, but the
 * comparison is cheap and this is the only thing standing between a hostile
 * local process and injecting its own authorization code into our callback.
 */
export function statesMatch(expected: string, received: string | undefined | null): boolean {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  // timingSafeEqual throws on length mismatch, so length is checked first —
  // length is not the secret here, the value is.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
