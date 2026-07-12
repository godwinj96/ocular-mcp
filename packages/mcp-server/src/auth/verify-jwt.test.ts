import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountRecord, AccountsRepository } from '../db/accounts-repository.js';

// Mocks only the AuthKit signature/expiry/issuer/audience layer, which is
// already exercised end-to-end (against a real local JWKS server) in
// verify-authkit-token.test.ts. This file is a pure unit test of the
// account/plan-resolution logic added on top of it — per
// docs/rules/10-testing.md §1, that split is the intended mock boundary.
vi.mock('./verify-authkit-token.js', () => ({
  verifyAuthKitToken: vi.fn(),
}));

const { verifyAuthKitToken } = await import('./verify-authkit-token.js');
const { createJwtVerifier, AuthError } = await import('./verify-jwt.js');

function fakeRepo(byOauthSubject: Record<string, AccountRecord | null>): AccountsRepository {
  return {
    findByOauthSubject: async (subjectId: string) => byOauthSubject[subjectId] ?? null,
    findByApiKeyHash: async () => null,
    touchApiKeyLastUsed: async () => undefined,
  };
}

describe('verifyJwt', () => {
  afterEach(() => {
    vi.mocked(verifyAuthKitToken).mockReset();
  });

  it('rejects when the underlying AuthKit token verification fails', async () => {
    vi.mocked(verifyAuthKitToken).mockRejectedValue(new Error('bad signature'));
    const verify = createJwtVerifier(fakeRepo({}));

    await expect(verify('token')).rejects.toThrow(AuthError);
  });

  it('rejects when the token is valid but no Postgres account row exists (webhook lag)', async () => {
    const sub = `user_${randomUUID()}`;
    vi.mocked(verifyAuthKitToken).mockResolvedValue({ sub });
    const verify = createJwtVerifier(fakeRepo({}));

    await expect(verify('token')).rejects.toThrow(AuthError);
  });

  it('rejects an account with no active subscription (plan is null)', async () => {
    const sub = `user_${randomUUID()}`;
    vi.mocked(verifyAuthKitToken).mockResolvedValue({ sub });
    const verify = createJwtVerifier(
      fakeRepo({ [sub]: { id: 'acct_1', plan: null, subscriptionStatus: 'none', quotaResetAt: null } }),
    );

    await expect(verify('token')).rejects.toThrow(AuthError);
  });

  it('rejects a canceled subscription even with a plan still set', async () => {
    const sub = `user_${randomUUID()}`;
    vi.mocked(verifyAuthKitToken).mockResolvedValue({ sub });
    const verify = createJwtVerifier(
      fakeRepo({ [sub]: { id: 'acct_1', plan: 'starter', subscriptionStatus: 'canceled', quotaResetAt: null } }),
    );

    await expect(verify('token')).rejects.toThrow(AuthError);
  });

  it('resolves { accountId, plan, authMethod: "oauth" } for an active account', async () => {
    const sub = `user_${randomUUID()}`;
    vi.mocked(verifyAuthKitToken).mockResolvedValue({ sub });
    const verify = createJwtVerifier(
      fakeRepo({ [sub]: { id: 'acct_1', plan: 'starter', subscriptionStatus: 'active', quotaResetAt: null } }),
    );

    const result = await verify('token');

    expect(result).toEqual({ accountId: 'acct_1', plan: 'starter', authMethod: 'oauth' });
  });
});
