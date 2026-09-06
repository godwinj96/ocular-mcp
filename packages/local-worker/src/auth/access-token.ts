// The single place the rest of the local worker asks "what bearer token do I
// send?". See docs/design/first-run-auth-and-payment.md §3 and §6.
//
// This exists specifically to collapse the THREE separate credential reads
// that used to exist (config.ts, cloud-client.ts, and a duplicated
// process.env read inside subscription/validate.ts) into one source of
// truth. Two of those agreed only by coincidence, because they happened to
// read the same env var.

import type { StoreDeps, StoredCredentials } from './credential-store.js';
import {
  clearCredentials,
  isExpired,
  loadCredentials,
  saveCredentials,
} from './credential-store.js';
import type { TokenClientDeps } from './token-client.js';
import { refreshAccessToken } from './token-client.js';

/** Refresh this long before actual expiry so an in-flight request cannot outlive its token. */
export const REFRESH_SKEW_MS = 60_000;

export type AccessTokenResult =
  | { kind: 'ok'; accessToken: string }
  /** Definitive: no credentials, or the issuer refused them. Re-run login. */
  | { kind: 'unauthenticated'; detail: string }
  /** Indeterminate: offline. Callers must apply grace, never treat as cancelled. */
  | { kind: 'network_error'; detail: string };

export interface TokenProviderDeps {
  store: StoreDeps;
  tokenClient: TokenClientDeps;
  now?: () => number;
}

export class TokenProvider {
  /** De-dupes concurrent refreshes; several captures can race on one expired token. */
  private inFlight: Promise<AccessTokenResult> | null = null;

  constructor(private readonly deps: TokenProviderDeps) {}

  async getAccessToken(): Promise<AccessTokenResult> {
    const now = this.deps.now ?? Date.now;

    const credentials = await loadCredentials(this.deps.store);
    if (!credentials) {
      return { kind: 'unauthenticated', detail: 'no stored credentials — run the login flow' };
    }

    if (!isExpired(credentials, now(), REFRESH_SKEW_MS)) {
      return { kind: 'ok', accessToken: credentials.accessToken };
    }

    // Expired. Refresh once, even if several callers arrive together —
    // rotation means a second concurrent exchange would invalidate the first.
    if (!this.inFlight) {
      this.inFlight = this.refresh(credentials).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async refresh(credentials: StoredCredentials): Promise<AccessTokenResult> {
    const result = await refreshAccessToken(credentials.refreshToken, this.deps.tokenClient);

    if (result.kind === 'network_error') {
      // Do NOT clear the store. The credential may be perfectly valid; we
      // simply could not reach the issuer.
      return { kind: 'network_error', detail: result.detail };
    }

    if (result.kind === 'rejected') {
      // Definitive: revoked, or the subscription ended. Clearing here is what
      // makes the next run re-enter the login flow instead of looping on a
      // dead token.
      await clearCredentials(this.deps.store);
      return { kind: 'unauthenticated', detail: result.detail };
    }

    // Persist the rotated pair BEFORE handing the token out. If the process
    // dies between the exchange and the write, the old refresh token is
    // already spent and the user would be silently logged out.
    await saveCredentials(result.credentials, this.deps.store);
    return { kind: 'ok', accessToken: result.credentials.accessToken };
  }
}
