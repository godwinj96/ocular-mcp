import { describe, expect, it, vi } from 'vitest';
import type { AccountRecord, AccountsRepository } from '../db/accounts-repository.js';
import { hashApiKey } from './hash-key.js';
import { AuthError } from './verify-jwt.js';
import { createStaticKeyVerifier } from './verify-static-key.js';

function fakeRepo(byKeyHash: Record<string, AccountRecord | null>): AccountsRepository & {
  touchApiKeyLastUsed: ReturnType<typeof vi.fn>;
} {
  return {
    findByOauthSubject: async () => null,
    findByApiKeyHash: async (keyHash: string) => byKeyHash[keyHash] ?? null,
    touchApiKeyLastUsed: vi.fn(async () => undefined),
  };
}

describe('verifyStaticKey', () => {
  it('rejects an unknown key', async () => {
    const verify = createStaticKeyVerifier(fakeRepo({}));

    await expect(verify('ocular_sk_unknown')).rejects.toThrow(AuthError);
  });

  it('rejects a key belonging to a non-active account', async () => {
    const rawKey = 'ocular_sk_inactive';
    const repo = fakeRepo({
      [hashApiKey(rawKey)]: { id: 'acct_1', plan: 'starter', subscriptionStatus: 'past_due', quotaResetAt: null },
    });
    const verify = createStaticKeyVerifier(repo);

    await expect(verify(rawKey)).rejects.toThrow(AuthError);
  });

  it('resolves { accountId, plan, authMethod: "static_key" } and touches last_used_at', async () => {
    const rawKey = 'ocular_sk_active';
    const repo = fakeRepo({
      [hashApiKey(rawKey)]: { id: 'acct_1', plan: 'starter', subscriptionStatus: 'active', quotaResetAt: null },
    });
    const verify = createStaticKeyVerifier(repo);

    const result = await verify(rawKey);

    expect(result).toEqual({ accountId: 'acct_1', plan: 'starter', authMethod: 'static_key' });
    expect(repo.touchApiKeyLastUsed).toHaveBeenCalledWith(hashApiKey(rawKey));
  });

  it('does not fail auth when the best-effort last_used_at update rejects', async () => {
    const rawKey = 'ocular_sk_active';
    const repo = fakeRepo({
      [hashApiKey(rawKey)]: { id: 'acct_1', plan: 'starter', subscriptionStatus: 'active', quotaResetAt: null },
    });
    repo.touchApiKeyLastUsed.mockRejectedValueOnce(new Error('db hiccup'));
    const verify = createStaticKeyVerifier(repo);

    await expect(verify(rawKey)).resolves.toEqual({ accountId: 'acct_1', plan: 'starter', authMethod: 'static_key' });
  });
});
