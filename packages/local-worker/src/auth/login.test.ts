import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreDeps } from './credential-store.js';
import { loadCredentials } from './credential-store.js';
import { buildConnectUrl, runLogin } from './login.js';

const NOW = 1_700_000_000_000;
const CONNECT_URL = 'https://app.useocular.com/connect';

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

/**
 * Stands in for the browser: reads the /connect URL the worker opened, and
 * calls back to the loopback server the way AuthKit's redirect eventually
 * would.
 */
function browserThatCallsBack(options: {
  code?: string;
  state?: string;
  error?: string;
  /**
   * Simulate the rewrite Vercel's edge performs on /connect's `redirect_uri`
   * (127.0.0.1 -> localhost), so the browser lands on a different spelling of
   * the loopback host than the worker advertised. See LoopbackCallback.
   */
  dialHost?: string;
}) {
  return vi.fn(async (url: string) => {
    const parsed = new URL(url);
    const redirectUri = parsed.searchParams.get('redirect_uri');
    const state = options.state ?? parsed.searchParams.get('state') ?? '';
    const cb = new URL(redirectUri as string);
    if (options.dialHost) cb.hostname = options.dialHost;
    if (options.error) {
      cb.searchParams.set('error', options.error);
    } else {
      cb.searchParams.set('code', options.code ?? 'auth-code');
      cb.searchParams.set('state', state);
    }
    // Fired without awaiting, mirroring a real browser navigating on its own.
    void fetch(cb.toString()).catch(() => undefined);
  });
}

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'ocular-login-'));
  store = { baseDir, platform: 'linux' };
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('buildConnectUrl', () => {
  it('sends the challenge and never the verifier', () => {
    const url = buildConnectUrl({
      connectUrl: CONNECT_URL,
      redirectUri: 'http://127.0.0.1:5555/callback',
      codeChallenge: 'the-challenge',
      state: 'the-state',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('code_challenge')).toBe('the-challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback');
    expect(url).not.toContain('code_verifier');
  });

  it('points at the dashboard, not AuthKit — payment happens before the bounce', () => {
    const url = buildConnectUrl({
      connectUrl: CONNECT_URL,
      redirectUri: 'http://127.0.0.1:1/callback',
      codeChallenge: 'c',
      state: 's',
    });
    expect(new URL(url).origin).toBe('https://app.useocular.com');
    expect(url).not.toContain('api.workos.com');
  });
});

describe('runLogin', () => {
  it('completes the whole flow and persists credentials', async () => {
    const access = jwt({ exp: (NOW + 3_600_000) / 1000, sub: 'user_01XYZ' });
    const fetchFn = vi.fn(async (url: string) => {
      // Only the token exchange is mocked; the loopback callback is a real
      // HTTP request handled by the real server.
      if (String(url).includes('user_management/authenticate')) {
        return jsonResponse(200, { access_token: access, refresh_token: 'refresh-1' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: fetchFn as unknown as typeof fetch },
      openBrowser: browserThatCallsBack({ code: 'the-code' }),
      timeoutMs: 3000,
    });

    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.subject).toBe('user_01XYZ');

    const stored = await loadCredentials(store);
    expect(stored?.accessToken).toBe(access);
    expect(stored?.refreshToken).toBe('refresh-1');
  });

  it('sends the matching verifier to the token endpoint', async () => {
    const access = jwt({ exp: (NOW + 3_600_000) / 1000, sub: 'u' });
    let sentVerifier: string | null = null;
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      sentVerifier = new URLSearchParams(init.body as string).get('code_verifier');
      return jsonResponse(200, { access_token: access, refresh_token: 'r' });
    });

    await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: fetchFn as unknown as typeof fetch },
      openBrowser: browserThatCallsBack({}),
      timeoutMs: 3000,
    });

    expect(sentVerifier).toBeTruthy();
    expect((sentVerifier as unknown as string).length).toBeGreaterThanOrEqual(43);
  });

  it('exchanges with the host the browser dialled, not the one it advertised', async () => {
    // Regression: the deployed dashboard sits behind Vercel, whose edge
    // rewrites the `redirect_uri` query parameter from 127.0.0.1 to
    // localhost. Sending the advertised 127.0.0.1 form at the token endpoint
    // then violates RFC 6749 §4.1.3's exact-match rule and AuthKit answers
    // invalid_grant — the failure lands on the very last step of first-run
    // login, after the user has already signed in and paid.
    const access = jwt({ exp: (NOW + 3_600_000) / 1000, sub: 'u' });
    let sentRedirectUri: string | null = null;
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      sentRedirectUri = new URLSearchParams(init.body as string).get('redirect_uri');
      return jsonResponse(200, { access_token: access, refresh_token: 'r' });
    });

    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: fetchFn as unknown as typeof fetch },
      openBrowser: browserThatCallsBack({ dialHost: 'localhost' }),
      timeoutMs: 3000,
    });

    expect(outcome.kind).toBe('ok');
    expect(sentRedirectUri).toMatch(/^http:\/\/localhost:\d+\/callback$/);
  });

  it('fails without storing anything when the callback state does not match', async () => {
    const fetchFn = vi.fn();
    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: fetchFn as unknown as typeof fetch },
      openBrowser: browserThatCallsBack({ state: 'attacker-supplied-state' }),
      timeoutMs: 3000,
    });

    expect(outcome.kind).toBe('failed');
    // Never exchanged, so never stored.
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await loadCredentials(store)).toBeNull();
  });

  it('fails cleanly when the user declines in the browser', async () => {
    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: vi.fn() as unknown as typeof fetch },
      openBrowser: browserThatCallsBack({ error: 'access_denied' }),
      timeoutMs: 3000,
    });
    expect(outcome.kind).toBe('failed');
    expect(await loadCredentials(store)).toBeNull();
  });

  it('surfaces the URL when no browser can be opened — the headless case', async () => {
    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: vi.fn() as unknown as typeof fetch },
      openBrowser: vi.fn().mockRejectedValue(new Error('xdg-open not found')),
      timeoutMs: 500,
    });

    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') return;
    // A user on an SSH box must still be able to finish by hand.
    expect(outcome.detail).toContain(CONNECT_URL);
    expect(outcome.detail).toContain('code_challenge');
  });

  it('times out instead of hanging when the browser never comes back', async () => {
    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: vi.fn() as unknown as typeof fetch },
      openBrowser: vi.fn().mockResolvedValue(undefined),
      timeoutMs: 60,
    });
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') return;
    expect(outcome.detail).toMatch(/timed out/i);
  });

  it('reports a failed token exchange without storing anything', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' }));
    const outcome = await runLogin({
      connectUrl: CONNECT_URL,
      store,
      tokenClient: { clientId: 'client_test', fetchFn: fetchFn as unknown as typeof fetch },
      openBrowser: browserThatCallsBack({}),
      timeoutMs: 3000,
    });

    expect(outcome.kind).toBe('failed');
    expect(await loadCredentials(store)).toBeNull();
  });

  it('reports when credentials could not be hardened rather than claiming success silently', async () => {
    const access = jwt({ exp: (NOW + 3_600_000) / 1000, sub: 'u' });
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: access, refresh_token: 'r' }));

    const prev = process.env.USERNAME;
    delete process.env.USERNAME;
    try {
      const outcome = await runLogin({
        connectUrl: CONNECT_URL,
        // win32 with no USERNAME -> cannot scope an ACL.
        store: { baseDir, platform: 'win32', runCommand: vi.fn().mockResolvedValue(true) },
        tokenClient: { clientId: 'client_test', fetchFn: fetchFn as unknown as typeof fetch },
        openBrowser: browserThatCallsBack({}),
        timeoutMs: 3000,
      });

      expect(outcome.kind).toBe('ok');
      if (outcome.kind !== 'ok') return;
      expect(outcome.credentialsHardened).toBe(false);
      expect(outcome.hardenDetail).toBeDefined();
    } finally {
      if (prev !== undefined) process.env.USERNAME = prev;
    }
  });
});
