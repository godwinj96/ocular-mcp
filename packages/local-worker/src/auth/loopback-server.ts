// One-shot loopback HTTP server that receives the OAuth authorization code.
// See docs/design/first-run-auth-and-payment.md §4.2 steps 8-12.
//
// Binding: 127.0.0.1 ONLY, never 0.0.0.0. CLAUDE.md makes invisibility a hard
// requirement, and a firewall prompt asking to accept incoming connections
// directly contradicts it. This is the same rule the IPC socket follows.
//
// Lifetime: the server accepts exactly one callback and then stops. It also
// stops on a hard timeout, so an abandoned login never leaves a listening
// socket behind for the rest of the process's life.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { statesMatch } from './pkce.js';

export const CALLBACK_PATH = '/callback';
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export class LoginCancelledError extends Error {
  constructor(reason: string) {
    super(`Login was not completed: ${reason}`);
    this.name = 'LoginCancelledError';
  }
}

export class LoginTimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${Math.round(ms / 1000)}s waiting for the browser to finish sign-in.`);
    this.name = 'LoginTimeoutError';
  }
}

/**
 * Hosts a callback may arrive on. Mirrors the dashboard's own allowlist.
 *
 * Both spellings of the IPv6 literal are listed: Node's URL parser keeps the
 * brackets on `hostname`, but the bare form costs nothing and removes the
 * dependency on which way that goes.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export interface LoopbackCallback {
  code: string;
  /**
   * The redirect_uri to present at the token endpoint — NOT necessarily the
   * one we advertised.
   *
   * RFC 6749 §4.1.3 requires this value to be identical to the redirect_uri
   * the authorization request carried, and we cannot assume that is the URI
   * we handed out. The dashboard is served by Vercel, whose edge rewrites a
   * query parameter named `redirect_uri` from `http://127.0.0.1:<port>/...`
   * to `http://localhost:<port>/...` before /connect ever runs. Verified
   * 2026-09-06 against the deployed dashboard: a parameter of any other name
   * carrying the identical value passes through untouched, and the same
   * request against a local `next dev` is not rewritten at all — so this is
   * the platform, not our middleware, and not something we can turn off.
   *
   * Sending the advertised 127.0.0.1 form after an authorize call that
   * recorded `localhost` fails the exchange with `invalid_grant`, which is
   * the last step of the first-run login.
   *
   * So use the host the browser actually dialled, read from the callback's
   * Host header. That is client-controlled, hence the allowlist and the port
   * check below; and it is in any case a value the authorization server
   * independently compares against one we never supplied it, so a wrong
   * guess can only fail the exchange, never redirect a code anywhere.
   */
  redirectUri: string;
}

export interface LoopbackServer {
  port: number;
  redirectUri: string;
  /** Resolves once the browser hits the callback. */
  waitForCode(): Promise<LoopbackCallback>;
  close(): Promise<void>;
}

/**
 * Reconstruct the redirect_uri from the callback's Host header, falling back
 * to the advertised one for anything not provably our own loopback listener.
 */
export function resolveDialledRedirectUri(
  hostHeader: string | undefined,
  port: number,
  advertised: string,
): string {
  if (!hostHeader) return advertised;

  let parsed: URL;
  try {
    // Parsing as a URL rather than splitting on ':' so that an IPv6 literal,
    // userinfo (`user@evil.example`), and a missing port are all handled by
    // the same well-tested code path rather than by string arithmetic.
    parsed = new URL(`http://${hostHeader}`);
  } catch {
    return advertised;
  }

  if (parsed.username || parsed.password) return advertised;
  if (parsed.port !== String(port)) return advertised;
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return advertised;

  // parsed.host keeps the brackets on an IPv6 literal; parsed.hostname strips
  // them, and the URI has to be reassembled in the bracketed form.
  return `http://${parsed.host}${CALLBACK_PATH}`;
}

export interface LoopbackOptions {
  expectedState: string;
  timeoutMs?: number;
}

function page(title: string, body: string): string {
  // Deliberately dependency-free and inline — this renders once, in a tab the
  // user is about to close.
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:15px/1.6 system-ui,-apple-system,sans-serif;display:grid;place-items:center;
height:100vh;margin:0;background:#0e0e10;color:#e8e8ea}main{text-align:center;max-width:34ch}
h1{font-size:1.05rem;font-weight:600;margin:0 0 .4rem}p{margin:0;opacity:.65}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

export async function startLoopbackServer(options: LoopbackOptions): Promise<LoopbackServer> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Assigned immediately after listen(), before any request can arrive — the
  // handler below is the only reader and it cannot run until the socket is
  // bound, which is what makes the empty initial values unobservable.
  let boundPort = 0;
  let advertisedRedirectUri = '';

  let resolveCode: (callback: LoopbackCallback) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<LoopbackCallback>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  // The promise exists from the moment the server starts, but the caller may
  // not attach waitForCode() until after a rejection has already happened (a
  // stray callback, or the timeout firing on an abandoned login). Without
  // this no-op handler that surfaces as an unhandled rejection, which is
  // fatal under --unhandled-rejections=strict. The rejection stays fully
  // observable to whoever calls waitForCode() later.
  void codePromise.catch(() => undefined);

  let settled = false;
  const settleOk = (callback: LoopbackCallback) => {
    if (settled) return;
    settled = true;
    resolveCode(callback);
  };
  const settleErr = (error: Error) => {
    if (settled) return;
    settled = true;
    rejectCode(error);
  };

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // `req.url` is a path-relative URL; the base is only there to parse it.
    const url = new URL(req.url ?? '/', `http://127.0.0.1`);

    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }

    const error = url.searchParams.get('error');
    if (error) {
      const description = url.searchParams.get('error_description') ?? error;
      res
        .writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        .end(page('Sign-in was cancelled', 'You can close this tab and try again.'));
      settleErr(new LoginCancelledError(description));
      return;
    }

    const state = url.searchParams.get('state');
    if (!statesMatch(options.expectedState, state)) {
      // A mismatched state is the CSRF case: someone else's authorization
      // code being delivered to our callback. Never exchange it.
      res
        .writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        .end(page('Something went wrong', 'The sign-in response did not match this request.'));
      settleErr(
        new LoginCancelledError('state mismatch — the response did not match this request'),
      );
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      res
        .writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        .end(page('Something went wrong', 'No authorization code was returned.'));
      settleErr(new LoginCancelledError('no authorization code in the callback'));
      return;
    }

    res
      .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      .end(page("You're connected", 'You can close this tab and return to your terminal.'));
    settleOk({
      code,
      redirectUri: resolveDialledRedirectUri(req.headers.host, boundPort, advertisedRedirectUri),
    });
  });

  // 127.0.0.1 explicitly. Passing no host would bind every interface.
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const port = (server.address() as AddressInfo).port;
  boundPort = port;
  // Advertise the IP literal, not `localhost`: RFC 8252 §8.3 prefers it
  // precisely because `localhost` is resolver-dependent and a hosts-file
  // entry could point it off-machine. The Vercel rewrite described on
  // LoopbackCallback.redirectUri is absorbed at exchange time instead of by
  // giving that preference up here.
  advertisedRedirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;

  const timer = setTimeout(() => settleErr(new LoginTimeoutError(timeoutMs)), timeoutMs);
  // Do not hold the event loop open purely for the login timeout.
  timer.unref?.();

  const close = () =>
    new Promise<void>((resolve) => {
      clearTimeout(timer);
      server.close(() => resolve());
      // Sockets kept alive by the browser would otherwise delay close().
      server.closeAllConnections?.();
    });

  return {
    port,
    redirectUri: advertisedRedirectUri,
    waitForCode: () => codePromise,
    close,
  };
}
