// The first-run login flow, end to end. See
// docs/design/first-run-auth-and-payment.md §4.2.
//
// One browser visit. The worker opens the DASHBOARD's /connect route rather
// than AuthKit directly, because payment has to happen before a credential is
// issued and the dashboard is what owns sign-in -> subscription check ->
// checkout. AuthKit's loopback bounce is the last hop, which is what delivers
// the code back to this machine without the user copying anything.
//
// PKCE integrity: the code_verifier never leaves this process. /connect only
// ever receives the challenge (a SHA-256 hash), so it cannot mint tokens.

import { spawn } from 'node:child_process';
import type { StoreDeps } from './credential-store.js';
import { saveCredentials } from './credential-store.js';
import { startLoopbackServer, type LoopbackCallback } from './loopback-server.js';
import { createPkcePair, createState } from './pkce.js';
import type { TokenClientDeps } from './token-client.js';
import { exchangeAuthorizationCode } from './token-client.js';

export interface LoginDeps {
  /** Dashboard /connect endpoint that orchestrates sign-in, payment, and the AuthKit bounce. */
  connectUrl: string;
  store: StoreDeps;
  tokenClient: TokenClientDeps;
  openBrowser?: (url: string) => Promise<void>;
  timeoutMs?: number;
}

export type LoginOutcome =
  | { kind: 'ok'; subject: string; credentialsHardened: boolean; hardenDetail?: string }
  | { kind: 'failed'; detail: string };

export interface BrowserLaunch {
  command: string;
  args: string[];
  windowsVerbatimArguments: boolean;
}

/**
 * How to hand a URL to the platform's default browser.
 *
 * A pure function because the Windows form is a trap that unit tests had no
 * way to see: every runLogin test injects `openBrowser`, so the real launcher
 * was never executed by the suite while being broken in production.
 *
 * The trap: `spawn` leaves an argument unquoted unless it contains a space,
 * tab or double quote, and a /connect URL contains none of those. cmd.exe
 * therefore received the URL bare and split it at the first `&`, which is its
 * command separator. The browser opened with only `?redirect_uri=...` and the
 * dashboard answered `code_challenge is required` — the same message as the
 * unrelated middleware bug in design §4.2a, which is what disguised it.
 * Verified 2026-09-06: `cmd /c echo <url>` prints up to the first `&` and
 * then reports `'code_challenge' is not recognized as a command`.
 *
 * So build the command line ourselves and wrap the URL in double quotes,
 * inside which cmd does not treat `&` as a separator. The empty `""` stays —
 * it is start's window-title argument, without which a quoted URL is consumed
 * as the title and nothing opens.
 */
export function browserLaunchCommand(platform: NodeJS.Platform, url: string): BrowserLaunch {
  if (platform !== 'win32') {
    return {
      command: platform === 'darwin' ? 'open' : 'xdg-open',
      args: [url],
      windowsVerbatimArguments: false,
    };
  }

  // A double quote in the URL would close our quoting and hand the remainder
  // to cmd as commands. URLSearchParams percent-encodes it, so this guards a
  // future caller that does not rather than a live case — and it fails loudly
  // into runLogin's "open this URL manually" path instead of executing it.
  if (/["\r\n]/.test(url)) {
    throw new Error('refusing to open a URL containing a quote or newline');
  }

  return {
    command: 'cmd',
    args: ['/c', 'start', '""', `"${url}"`],
    windowsVerbatimArguments: true,
  };
}

/**
 * Opens the user's default browser. Deliberately fire-and-forget: we do not
 * wait for the browser process, only for the loopback callback. `windowsHide`
 * keeps a console window from flashing, which CLAUDE.md treats as a hard
 * invisibility requirement rather than polish.
 */
function defaultOpenBrowser(url: string): Promise<void> {
  const launch = browserLaunchCommand(process.platform, url);

  return new Promise((resolve, reject) => {
    const child = spawn(launch.command, launch.args, {
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
      detached: process.platform !== 'win32',
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

export function buildConnectUrl(params: {
  connectUrl: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(params.connectUrl);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

export async function runLogin(deps: LoginDeps): Promise<LoginOutcome> {
  const pkce = createPkcePair();
  const state = createState();

  const server = await startLoopbackServer({
    expectedState: state,
    ...(deps.timeoutMs !== undefined ? { timeoutMs: deps.timeoutMs } : {}),
  });

  try {
    const url = buildConnectUrl({
      connectUrl: deps.connectUrl,
      redirectUri: server.redirectUri,
      codeChallenge: pkce.challenge,
      state,
    });

    const open = deps.openBrowser ?? defaultOpenBrowser;
    try {
      await open(url);
    } catch (error) {
      // A machine with no browser (SSH, container) lands here. Surface the URL
      // rather than dying silently — and this is the case design §8's
      // --device fallback exists for.
      return {
        kind: 'failed',
        detail: `could not open a browser (${
          error instanceof Error ? error.message : 'unknown'
        }). Open this URL manually: ${url}`,
      };
    }

    let callback: LoopbackCallback;
    try {
      callback = await server.waitForCode();
    } catch (error) {
      return { kind: 'failed', detail: error instanceof Error ? error.message : 'login failed' };
    }

    // callback.redirectUri, not server.redirectUri: the authorization request
    // may not have carried the URI we advertised. See LoopbackCallback.
    const exchanged = await exchangeAuthorizationCode(
      {
        code: callback.code,
        codeVerifier: pkce.verifier,
        redirectUri: callback.redirectUri,
      },
      deps.tokenClient,
    );

    if (exchanged.kind !== 'ok') {
      return { kind: 'failed', detail: exchanged.detail };
    }

    const hardened = await saveCredentials(exchanged.credentials, deps.store);
    return {
      kind: 'ok',
      subject: exchanged.credentials.subject,
      credentialsHardened: hardened.hardened,
      ...(hardened.detail !== undefined ? { hardenDetail: hardened.detail } : {}),
    };
  } finally {
    // Always stop listening, on every path.
    await server.close();
  }
}
