// AuthKit JWT verification. See docs/rules/04-mcp-server-and-auth.md §2.
// - Verify signature against AuthKit's JWKS (cached in-process, TTL = JWKS_CACHE_TTL_S)
// - Check `aud` matches Ocular's resource identifier
// - Check expiry
// - On ANY failure: throw AuthError('UNAUTHORIZED') — never fail open

import type { AccountsRepository } from '../db/accounts-repository.js';
import { accountsRepository } from '../db/accounts-repository.js';
import { verifyAuthKitToken } from './verify-authkit-token.js';

export interface VerifiedAuth {
  accountId: string;
  plan: string;
  authMethod: 'oauth' | 'static_key';
}

export class AuthError extends Error {}

// Factory (not a bare module-scope function) so tests can point account
// resolution at a disposable repository instead of the shared dev database —
// same pattern as verify-authkit-token.ts's createAuthKitVerifier.
export function createJwtVerifier(repo: AccountsRepository) {
  return async function verifyJwt(bearerToken: string): Promise<VerifiedAuth> {
    // The cryptographic verification (signature/exp/iss/aud) is fully real —
    // see verify-authkit-token.ts. A failure here throws and this function
    // never reaches the account/plan lookup below.
    let claims;
    try {
      claims = await verifyAuthKitToken(bearerToken);
    } catch (error) {
      throw new AuthError(`verifyJwt: token rejected — ${error instanceof Error ? error.message : 'invalid token'}`);
    }

    const account = await repo.findByOauthSubject(claims.sub);
    // No matching Postgres row (webhook lag, or signed in but never completed
    // Bachs checkout) or a non-active subscription -> UNAUTHORIZED, never a
    // default/guest quota. See docs/rules/11-billing-and-quota.md §3.
    if (!account || !account.plan || account.subscriptionStatus !== 'active') {
      throw new AuthError('verifyJwt: no active subscription for this account');
    }

    return { accountId: account.id, plan: account.plan, authMethod: 'oauth' };
  };
}

export const verifyJwt = createJwtVerifier(accountsRepository);
