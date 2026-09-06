import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_SKEW_MS, TokenProvider } from './access-token.js';
import type { StoreDeps, StoredCredentials } from './credential-store.js';
import { loadCredentials, saveCredentials } from './credential-store.js';

const NOW = 1_700_000_000_000;
let baseDir: string;
let store: StoreDeps;

function jwt(payload: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.sig`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fresh: StoredCredentials = {
  accessToken: 'fresh-access',
  refreshToken: 'refresh-1',
  expiresAt: NOW + 10 * REFRESH_SKEW_MS,
  subject: 'user_01ABC',
};

const stale: StoredCredentials = { ...fresh, accessToken: 'stale-access', expiresAt: NOW - 1000 };

function provider(fetchFn: typeof fetch) {
  return new TokenProvider({
    store,
    tokenClient: { clientId: 'client_test', fetchFn, now: () => NOW },
    now: () => NOW,
  });
}

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'ocular-token-'));
  store = { baseDir, platform: 'linux' };
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('TokenProvider.getAccessToken', () => {
  it('reports unauthenticated when nothing is stored', async () => {
    const fetchFn = vi.fn();
    const result = await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(result.kind).toBe('unauthenticated');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns a still-valid token without touching the network', async () => {
    await saveCredentials(fresh, store);
    const fetchFn = vi.fn();
    const result = await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(result).toEqual({ kind: 'ok', accessToken: 'fresh-access' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and persists the ROTATED refresh token', async () => {
    await saveCredentials(stale, store);
    const newAccess = jwt({ exp: (NOW + 3_600_000) / 1000, sub: 'user_01ABC' });
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { access_token: newAccess, refresh_token: 'refresh-2' }),
      );

    const result = await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(result).toEqual({ kind: 'ok', accessToken: newAccess });

    // The rotated token must be on disk, or the next refresh uses a spent one.
    const stored = await loadCredentials(store);
    expect(stored?.refreshToken).toBe('refresh-2');
    expect(stored?.accessToken).toBe(newAccess);
  });

  it('refreshes inside the skew window, before the token is actually expired', async () => {
    await saveCredentials({ ...fresh, expiresAt: NOW + REFRESH_SKEW_MS / 2 }, store);
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: 'a', refresh_token: 'b' }));
    await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('clears the store on a definitive rejection so the next run re-authenticates', async () => {
    await saveCredentials(stale, store);
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_grant' }));

    const result = await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(result.kind).toBe('unauthenticated');
    expect(await loadCredentials(store)).toBeNull();
  });

  it('KEEPS the store on a network error — dropped wifi is not a cancelled subscription', async () => {
    await saveCredentials(stale, store);
    const fetchFn = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

    const result = await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(result.kind).toBe('network_error');
    // This is the whole point: the credential survives so offline grace can apply.
    expect(await loadCredentials(store)).not.toBeNull();
  });

  it('keeps the store on a 5xx from the issuer', async () => {
    await saveCredentials(stale, store);
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(503, {}));

    const result = await provider(fetchFn as unknown as typeof fetch).getAccessToken();
    expect(result.kind).toBe('network_error');
    expect(await loadCredentials(store)).not.toBeNull();
  });

  it('refreshes only ONCE for concurrent callers — rotation makes a double exchange fatal', async () => {
    await saveCredentials(stale, store);
    let calls = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return jsonResponse(200, { access_token: 'shared-access', refresh_token: 'rotated' });
    });

    const p = provider(fetchFn as unknown as typeof fetch);
    const results = await Promise.all([
      p.getAccessToken(),
      p.getAccessToken(),
      p.getAccessToken(),
      p.getAccessToken(),
    ]);

    expect(calls).toBe(1);
    for (const r of results) {
      expect(r).toEqual({ kind: 'ok', accessToken: 'shared-access' });
    }
  });

  it('allows a later refresh after an in-flight one settles — the dedupe latch resets', async () => {
    await saveCredentials(stale, store);
    // Each refresh hands back an ALREADY-expired token, so the next call must
    // refresh again. This proves the in-flight latch is released rather than
    // wedging the provider after its first refresh.
    const expired = jwt({ exp: (NOW - 10_000) / 1000, sub: 'user_01ABC' });
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: expired, refresh_token: 'r1' }));
    const p = provider(fetchFn as unknown as typeof fetch);

    await p.getAccessToken();
    await p.getAccessToken();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('treats a token whose fallback lifetime has not elapsed as still fresh', async () => {
    // Guards the branch the previous test originally tripped over: an opaque
    // (non-JWT) token gets a 5-minute fallback lifetime, which is longer than
    // the 1-minute refresh skew, so it must NOT trigger an immediate refresh.
    await saveCredentials(stale, store);
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: 'opaque', refresh_token: 'r1' }));
    const p = provider(fetchFn as unknown as typeof fetch);

    await p.getAccessToken();
    await p.getAccessToken();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
