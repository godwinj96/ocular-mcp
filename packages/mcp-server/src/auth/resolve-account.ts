// Bearer token -> { accountId, plan }. Tries AuthKit JWT first, falls back to a
// static API key. See docs/rules/04-mcp-server-and-auth.md §3 step 1-3.
// Rule: an AuthKit-authenticated user with no matching Postgres account row is
// UNAUTHORIZED — webhook lag from Bachs is never a reason to grant default quota.

import type { VerifiedAuth } from './verify-jwt.js';
import { verifyJwt } from './verify-jwt.js';
import { verifyStaticKey } from './verify-static-key.js';

export async function resolveAccount(authorizationHeader: string | undefined): Promise<VerifiedAuth> {
  const bearerToken = authorizationHeader?.replace(/^Bearer\s+/i, '');
  if (!bearerToken) {
    throw new Error('UNAUTHORIZED: missing bearer token');
  }

  // TODO(M1): distinguish an AuthKit JWT from a static key (e.g. by prefix/format)
  // and route to the matching verifier instead of trying both.
  try {
    return await verifyJwt(bearerToken);
  } catch {
    return verifyStaticKey(bearerToken);
  }
}
