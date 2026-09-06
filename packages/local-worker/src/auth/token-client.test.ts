import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  readTokenClaims,
  refreshAccessToken,
} from './token-client.js';

const CLIENT_ID = 'client_test_123';
const NOW = 1_700_000_000_000;

function jwt(payload: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.signature`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function deps(fetchFn: typeof fetch) {
  return { clientId: CLIENT_ID, fetchFn, now: () => NOW };
}

describe('readTokenClaims', () => {
  it('reads exp and sub from a JWT payload', () => {
    const token = jwt({ exp: 1_700_000_900, sub: 'user_01ABC' });
    expect(readTokenClaims(token)).toEqual({ exp: 1_700_000_900, sub: 'user_01ABC' });
  });

  it('returns nulls for a non-JWT string rather than throwing', () => {
    expect(readTokenClaims('not-a-jwt')).toEqual({ exp: null, sub: '' });
  });

  it('returns nulls for a JWT with an unparseable payload', () => {
    expect(readTokenClaims('a.!!!not-base64-json!!!.c')).toEqual({ exp: null, sub: '' });
  });
});

describe('exchangeAuthorizationCode', () => {
  it('posts the PKCE verifier and returns credentials with expiry from the exp claim', async () => {
    const access = jwt({ exp: 1_700_000_900, sub: 'user_01ABC' });
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: access, refresh_token: 'refresh-1' }));

    const result = await exchangeAuthorizationCode(
      { code: 'code-1', codeVerifier: 'verifier-1', redirectUri: 'http://127.0.0.1:5555/callback' },
      deps(fetchFn as unknown as typeof fetch),
    );

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.credentials).toEqual({
      accessToken: access,
      refreshToken: 'refresh-1',
      expiresAt: 1_700_000_900 * 1000,
      subject: 'user_01ABC',
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.workos.com/user_management/authenticate');
    const sent = new URLSearchParams(init.body as string);
    expect(sent.get('grant_type')).toBe('authorization_code');
    expect(sent.get('code_verifier')).toBe('verifier-1');
    expect(sent.get('client_id')).toBe(CLIENT_ID);
    expect(sent.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback');
  });

  it('falls back to a short lifetime when the token carries no exp claim', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { access_token: 'opaque-token', refresh_token: 'refresh-1' }),
      );
    const result = await exchangeAuthorizationCode(
      { code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:1/callback' },
      deps(fetchFn as unknown as typeof fetch),
    );
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    // Conservative: refresh soon rather than trusting an unknown lifetime.
    expect(result.credentials.expiresAt).toBe(NOW + 5 * 60_000);
  });

  it('reports a 400 as DEFINITIVE rejection, not a network error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' }));
    const result = await exchangeAuthorizationCode(
      { code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:1/callback' },
      deps(fetchFn as unknown as typeof fetch),
    );
    expect(result.kind).toBe('rejected');
  });

  it('rejects a 200 that carries no usable token pair', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: 'only-access' }));
    const result = await exchangeAuthorizationCode(
      { code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:1/callback' },
      deps(fetchFn as unknown as typeof fetch),
    );
    expect(result.kind).toBe('rejected');
  });
});

describe('refreshAccessToken — the network/definitive split', () => {
  it('sends grant_type=refresh_token with the stored refresh token', async () => {
    const access = jwt({ exp: 1_700_000_900, sub: 'user_01ABC' });
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: access, refresh_token: 'rotated' }));

    const result = await refreshAccessToken(
      'old-refresh',
      deps(fetchFn as unknown as typeof fetch),
    );

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    // Rotation: the NEW refresh token must be what gets persisted.
    expect(result.credentials.refreshToken).toBe('rotated');

    const sent = new URLSearchParams(fetchFn.mock.calls[0][1].body as string);
    expect(sent.get('grant_type')).toBe('refresh_token');
    expect(sent.get('refresh_token')).toBe('old-refresh');
  });

  it('treats a thrown fetch (dropped wifi) as network_error, NOT a cancelled subscription', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const result = await refreshAccessToken('r', deps(fetchFn as unknown as typeof fetch));
    expect(result.kind).toBe('network_error');
  });

  it('treats a 500 as network_error — an upstream bad deploy must not log the user out', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'unavailable' }));
    const result = await refreshAccessToken('r', deps(fetchFn as unknown as typeof fetch));
    expect(result.kind).toBe('network_error');
  });

  it('treats a 401 as a definitive rejection — a revoked token really is gone', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_grant' }));
    const result = await refreshAccessToken('r', deps(fetchFn as unknown as typeof fetch));
    expect(result.kind).toBe('rejected');
  });

  it('treats an unreadable body as network_error rather than inventing a rejection', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    const result = await refreshAccessToken('r', deps(fetchFn as unknown as typeof fetch));
    expect(result.kind).toBe('network_error');
  });
});

describe('buildAuthorizeUrl', () => {
  it('always requests S256, never plain', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: CLIENT_ID,
        redirectUri: 'http://127.0.0.1:5555/callback',
        codeChallenge: 'challenge-value',
        state: 'state-value',
      }),
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('provider')).toBe('authkit');
  });

  it('never puts the verifier in the URL — only the challenge may travel', () => {
    const url = buildAuthorizeUrl({
      clientId: CLIENT_ID,
      redirectUri: 'http://127.0.0.1:5555/callback',
      codeChallenge: 'challenge-value',
      state: 'state-value',
    });
    expect(url).not.toContain('code_verifier');
  });

  it('carries screen_hint when asked, so first run lands on sign-up', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: CLIENT_ID,
        redirectUri: 'http://127.0.0.1:5555/callback',
        codeChallenge: 'c',
        state: 's',
        screenHint: 'sign-up',
      }),
    );
    expect(url.searchParams.get('screen_hint')).toBe('sign-up');
  });
});
