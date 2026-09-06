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

export interface LoopbackServer {
  port: number;
  redirectUri: string;
  /** Resolves with the authorization code once the browser hits the callback. */
  waitForCode(): Promise<string>;
  close(): Promise<void>;
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

  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
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
  const settleOk = (code: string) => {
    if (settled) return;
    settled = true;
    resolveCode(code);
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
    settleOk(code);
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
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
    waitForCode: () => codePromise,
    close,
  };
}
