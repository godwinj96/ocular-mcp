import { describe, expect, it, vi } from 'vitest';

vi.mock('./verify-jwt.js', () => ({ verifyJwt: vi.fn() }));
vi.mock('./verify-static-key.js', () => ({ verifyStaticKey: vi.fn() }));

const { verifyJwt } = await import('./verify-jwt.js');
const { verifyStaticKey } = await import('./verify-static-key.js');
const { resolveAccount } = await import('./resolve-account.js');

describe('resolveAccount', () => {
  it('rejects a missing Authorization header', async () => {
    await expect(resolveAccount(undefined)).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejects a malformed Authorization header (no bearer token)', async () => {
    await expect(resolveAccount('Bearer ')).rejects.toThrow('UNAUTHORIZED');
  });

  it('resolves via verifyJwt when it succeeds', async () => {
    vi.mocked(verifyJwt).mockResolvedValue({ accountId: 'acct_1', plan: 'starter', authMethod: 'oauth' });

    const result = await resolveAccount('Bearer sometoken');

    expect(result).toEqual({ accountId: 'acct_1', plan: 'starter', authMethod: 'oauth' });
    expect(verifyStaticKey).not.toHaveBeenCalled();
  });

  it('falls back to verifyStaticKey when verifyJwt throws', async () => {
    vi.mocked(verifyJwt).mockRejectedValue(new Error('not a JWT'));
    vi.mocked(verifyStaticKey).mockResolvedValue({ accountId: 'acct_2', plan: 'starter', authMethod: 'static_key' });

    const result = await resolveAccount('Bearer ocular_sk_abc');

    expect(result).toEqual({ accountId: 'acct_2', plan: 'starter', authMethod: 'static_key' });
  });
});
