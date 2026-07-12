// Static API key verification — fallback path for headless/CI/unattended agents.
// See docs/rules/04-mcp-server-and-auth.md §2. Looks up key_hash directly in
// Postgres; no AuthKit round-trip. Keys are revocable/rotatable, no default expiry.

import type { AccountsRepository } from '../db/accounts-repository.js';
import { accountsRepository } from '../db/accounts-repository.js';
import { hashApiKey } from './hash-key.js';
import type { VerifiedAuth } from './verify-jwt.js';
import { AuthError } from './verify-jwt.js';

// Factory (not a bare module-scope function) so tests can point account
// resolution at a disposable repository instead of the shared dev database.
export function createStaticKeyVerifier(repo: AccountsRepository) {
  return async function verifyStaticKey(bearerToken: string): Promise<VerifiedAuth> {
    const keyHash = hashApiKey(bearerToken);
    const account = await repo.findByApiKeyHash(keyHash);
    // Unknown/revoked key or a non-active subscription -> UNAUTHORIZED, never
    // a default/guest quota. See docs/rules/11-billing-and-quota.md §3.
    if (!account || !account.plan || account.subscriptionStatus !== 'active') {
      throw new AuthError('verifyStaticKey: unknown, revoked, or inactive key');
    }

    // Best-effort — a failed last_used_at update must never block auth.
    await repo.touchApiKeyLastUsed(keyHash).catch(() => undefined);

    return { accountId: account.id, plan: account.plan, authMethod: 'static_key' };
  };
}

export const verifyStaticKey = createStaticKeyVerifier(accountsRepository);
