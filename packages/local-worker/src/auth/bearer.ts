// Resolves the bearer token the local worker sends to the cloud mcp-server.
// See docs/design/first-run-auth-and-payment.md §3 and §7.
//
// This is the MIGRATION seam. The cloud server's resolveAccount() already
// accepts an AuthKit JWT and falls back to a static key, so both credentials
// work server-side during the transition and there is no flag day. This file
// mirrors that precedence on the client.
//
// Precedence, and why:
//   1. Stored OAuth credentials, if any exist. Someone who has completed the
//      login flow should never silently keep using a stale pasted key.
//   2. OCULAR_API_KEY, only when there are NO stored credentials at all.
//   3. Otherwise unauthenticated.
//
// The one subtle rule: a NETWORK error during token refresh does NOT fall
// back to the static key. Falling back there would mask a refresh outage as a
// working request under a different identity, and would quietly re-auth the
// user as whoever the old key belongs to. Offline is offline; the caller
// applies grace.

import type { AccessTokenResult, TokenProvider } from './access-token.js';

export type BearerResult =
  | { kind: 'ok'; token: string; method: 'oauth' | 'static_key' }
  | { kind: 'unauthenticated'; detail: string }
  | { kind: 'network_error'; detail: string };

export interface BearerResolverDeps {
  tokenProvider: Pick<TokenProvider, 'getAccessToken'>;
  /** The legacy static key, if the user still has one configured. */
  staticApiKey?: string | undefined;
}

export function createBearerResolver(deps: BearerResolverDeps): () => Promise<BearerResult> {
  return async () => {
    const oauth: AccessTokenResult = await deps.tokenProvider.getAccessToken();

    if (oauth.kind === 'ok') {
      return { kind: 'ok', token: oauth.accessToken, method: 'oauth' };
    }

    if (oauth.kind === 'network_error') {
      // Deliberately NOT falling through to the static key — see header.
      return oauth;
    }

    if (deps.staticApiKey) {
      return { kind: 'ok', token: deps.staticApiKey, method: 'static_key' };
    }

    return { kind: 'unauthenticated', detail: oauth.detail };
  };
}
