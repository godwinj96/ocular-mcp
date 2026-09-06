import { describe, expect, it, vi } from 'vitest';
import type { AccessTokenResult } from './access-token.js';
import { createBearerResolver } from './bearer.js';

function providerReturning(result: AccessTokenResult) {
  return { getAccessToken: vi.fn<[], Promise<AccessTokenResult>>().mockResolvedValue(result) };
}

describe('createBearerResolver', () => {
  it('prefers stored OAuth credentials over a static key', async () => {
    const resolve = createBearerResolver({
      tokenProvider: providerReturning({ kind: 'ok', accessToken: 'oauth-token' }),
      staticApiKey: 'legacy-key',
    });
    expect(await resolve()).toEqual({ kind: 'ok', token: 'oauth-token', method: 'oauth' });
  });

  it('falls back to the static key only when there are no stored credentials', async () => {
    const resolve = createBearerResolver({
      tokenProvider: providerReturning({
        kind: 'unauthenticated',
        detail: 'no stored credentials',
      }),
      staticApiKey: 'legacy-key',
    });
    expect(await resolve()).toEqual({ kind: 'ok', token: 'legacy-key', method: 'static_key' });
  });

  it('reports unauthenticated when neither credential exists', async () => {
    const resolve = createBearerResolver({
      tokenProvider: providerReturning({ kind: 'unauthenticated', detail: 'nothing stored' }),
      staticApiKey: undefined,
    });
    const result = await resolve();
    expect(result.kind).toBe('unauthenticated');
  });

  it('does NOT fall back to the static key on a network error', async () => {
    // Falling back here would mask a refresh outage as a working request under
    // a different identity — silently re-authenticating the user as whoever
    // the stale key belongs to.
    const resolve = createBearerResolver({
      tokenProvider: providerReturning({ kind: 'network_error', detail: 'ENOTFOUND' }),
      staticApiKey: 'legacy-key',
    });
    const result = await resolve();
    expect(result.kind).toBe('network_error');
    if (result.kind !== 'network_error') return;
    expect(result.detail).toBe('ENOTFOUND');
  });

  it('treats an empty-string static key as absent', async () => {
    const resolve = createBearerResolver({
      tokenProvider: providerReturning({ kind: 'unauthenticated', detail: 'nothing stored' }),
      staticApiKey: '',
    });
    expect((await resolve()).kind).toBe('unauthenticated');
  });

  it('labels which credential was used, so callers can report the migration state', async () => {
    const oauth = createBearerResolver({
      tokenProvider: providerReturning({ kind: 'ok', accessToken: 't' }),
    });
    const legacy = createBearerResolver({
      tokenProvider: providerReturning({ kind: 'unauthenticated', detail: 'x' }),
      staticApiKey: 'k',
    });
    expect((await oauth()).kind === 'ok' && (await oauth())).toMatchObject({ method: 'oauth' });
    expect((await legacy()).kind === 'ok' && (await legacy())).toMatchObject({
      method: 'static_key',
    });
  });

  it('re-resolves on every call, so a login mid-session takes effect without a restart', async () => {
    const getAccessToken = vi
      .fn<[], Promise<AccessTokenResult>>()
      .mockResolvedValueOnce({ kind: 'unauthenticated', detail: 'not yet' })
      .mockResolvedValueOnce({ kind: 'ok', accessToken: 'after-login' });

    const resolve = createBearerResolver({ tokenProvider: { getAccessToken } });

    expect((await resolve()).kind).toBe('unauthenticated');
    expect(await resolve()).toEqual({ kind: 'ok', token: 'after-login', method: 'oauth' });
  });
});
