// WorkOS AuthKit token exchange and refresh. See
// docs/design/first-run-auth-and-payment.md §4.2 step 10 and §5.
//
// The single most important thing in this file is the three-way result:
// a DEFINITIVE rejection (revoked token, cancelled subscription) must never
// be confused with a NETWORK failure (dropped wifi, DNS). subscription/
// validate.ts already draws exactly that line for get_quota and applies a
// bounded offline-grace window to the network case only; collapsing the two
// here would make a flaky connection look like a cancellation and lock a
// paying user out of their own machine.

import type { StoredCredentials } from './credential-store.js';

const AUTHENTICATE_URL = 'https://api.workos.com/user_management/authenticate';
const AUTHORIZE_URL = 'https://api.workos.com/user_management/authorize';

/** Used only if the returned JWT carries no readable `exp` claim. */
const FALLBACK_LIFETIME_MS = 5 * 60_000;

export type TokenResult =
  | { kind: 'ok'; credentials: StoredCredentials }
  /** The server gave a definitive "no". Clear the store and re-authenticate. */
  | { kind: 'rejected'; detail: string }
  /** We never got an answer. Offline-grace applies; do NOT treat as cancelled. */
  | { kind: 'network_error'; detail: string };

export interface TokenClientDeps {
  clientId: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

interface AuthKitTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
}

/**
 * Reads `exp` and `sub` out of a JWT payload WITHOUT verifying the signature.
 * That is correct here and worth being explicit about: this token is a bearer
 * credential we just received over TLS from the issuer and are about to send
 * back to the issuer's own API. The cloud mcp-server does the real
 * cryptographic verification (verify-authkit-token.ts). All we need locally
 * is "when should I refresh this" — we are not making a trust decision.
 */
export function readTokenClaims(token: string): { exp: number | null; sub: string } {
  const parts = token.split('.');
  // Destructured rather than indexed: `parts.length === 3` does not narrow an
  // index access under noUncheckedIndexedAccess.
  const [, payloadPart] = parts;
  if (parts.length !== 3 || !payloadPart) return { exp: null, sub: '' };
  try {
    const payload: unknown = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (typeof payload !== 'object' || payload === null) return { exp: null, sub: '' };
    const p = payload as Record<string, unknown>;
    return {
      exp: typeof p.exp === 'number' && Number.isFinite(p.exp) ? p.exp : null,
      sub: typeof p.sub === 'string' ? p.sub : '',
    };
  } catch {
    return { exp: null, sub: '' };
  }
}

async function postForm(
  url: string,
  body: Record<string, string>,
  deps: TokenClientDeps,
): Promise<TokenResult> {
  const doFetch = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;

  let response: Response;
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
  } catch (error) {
    // Never reached the server at all.
    return {
      kind: 'network_error',
      detail: error instanceof Error ? error.message : 'request failed',
    };
  }

  if (response.status >= 500) {
    // The issuer is broken, not the credential. Treat as offline so grace
    // applies rather than logging the user out over a bad deploy upstream.
    return { kind: 'network_error', detail: `authorization server returned ${response.status}` };
  }

  if (!response.ok) {
    let detail = `authorization server returned ${response.status}`;
    try {
      const text = await response.text();
      if (text) detail = `${detail}: ${text.slice(0, 300)}`;
    } catch {
      // Body unreadable; the status alone is a definitive enough answer.
    }
    return { kind: 'rejected', detail };
  }

  let json: AuthKitTokenResponse;
  try {
    json = (await response.json()) as AuthKitTokenResponse;
  } catch {
    return { kind: 'network_error', detail: 'authorization server returned an unreadable body' };
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  const refreshToken = typeof json.refresh_token === 'string' ? json.refresh_token : '';
  if (!accessToken || !refreshToken) {
    return { kind: 'rejected', detail: 'authorization server returned no usable token pair' };
  }

  const claims = readTokenClaims(accessToken);
  return {
    kind: 'ok',
    credentials: {
      accessToken,
      refreshToken,
      expiresAt: claims.exp !== null ? claims.exp * 1000 : now() + FALLBACK_LIFETIME_MS,
      subject: claims.sub,
    },
  };
}

export function exchangeAuthorizationCode(
  params: { code: string; codeVerifier: string; redirectUri: string },
  deps: TokenClientDeps,
): Promise<TokenResult> {
  return postForm(
    AUTHENTICATE_URL,
    {
      grant_type: 'authorization_code',
      client_id: deps.clientId,
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    },
    deps,
  );
}

export function refreshAccessToken(
  refreshToken: string,
  deps: TokenClientDeps,
): Promise<TokenResult> {
  return postForm(
    AUTHENTICATE_URL,
    {
      grant_type: 'refresh_token',
      client_id: deps.clientId,
      refresh_token: refreshToken,
    },
    deps,
  );
}

/**
 * The AuthKit authorize URL. Only used by the --device fallback and by tests;
 * the normal flow reaches AuthKit through the dashboard's /connect route so
 * that payment happens in the same browser visit (design §4.2).
 */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  screenHint?: 'sign-up' | 'sign-in';
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  url.searchParams.set('provider', 'authkit');
  if (params.screenHint) url.searchParams.set('screen_hint', params.screenHint);
  return url.toString();
}
