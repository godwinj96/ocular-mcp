// The ONLY file in packages/local-worker permitted to speak raw CDP — see
// docs/rules/02-repo-structure.md §1 ("headless-shell.ts — ONLY CDP
// touchpoint") and docs/rules/01-architecture.md §3's identical rule for
// packages/worker/src/providers/self-hosted-provider.ts and patchright.
//
// Deliberately uses no CDP client library (no chrome-remote-interface, no
// puppeteer-core) — Node 24's built-in global WebSocket is sufficient for
// the small, flat-session-mode CDP surface this needs (Target/Page/Runtime
// domains only), and adding a dependency here just to avoid ~150 lines of
// protocol plumbing isn't worth it for a package this size. If the CDP
// surface grows substantially (Phase 5's motion capture, DOM/asset
// extraction beyond Runtime.evaluate), revisit.
//
// This file does NOT spawn chrome-headless-shell itself. Per
// docs/rules/13-local-worker-and-distribution.md §2's process diagram, the
// Go supervisor owns process spawn/kill (see supervisor/browser.go) — this
// file only connects to the DevTools WebSocket URL the supervisor hands
// back over IPC (see ../supervisor/client.ts). Splitting it this way keeps
// "which process is running" and "what that process is told to render" on
// the two sides the rest of the architecture already assumes.

interface CdpCommand {
  id: number;
  method: string;
  params?: Record<string, unknown>;
  sessionId?: string;
}

interface CdpResponse {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
  sessionId?: string;
}

// Minimal CDP transport: request/response correlation by `id`, plus a
// per-(sessionId, method) event subscription mechanism for waiting on
// lifecycle events (Page.domContentEventFired, etc.). One connection per
// browser process, at the *browser* target — page-level commands are
// addressed via `sessionId` (CDP's "flat" session mode), never a second
// WebSocket per page.
class CdpConnection {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private eventListeners = new Map<string, Array<(params: Record<string, unknown>) => void>>();
  private ready: Promise<void>;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', () =>
        reject(new Error(`Failed to connect to CDP endpoint: ${wsUrl}`)),
      );
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event.data as string));
  }

  private handleMessage(raw: string): void {
    let msg: CdpResponse;
    try {
      msg = JSON.parse(raw) as CdpResponse;
    } catch {
      return;
    }

    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(`CDP error (${msg.error.code}): ${msg.error.message}`));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (msg.method) {
      const key = eventKey(msg.method, msg.sessionId);
      const listeners = this.eventListeners.get(key);
      if (listeners) {
        for (const listener of listeners) listener(msg.params ?? {});
      }
    }
  }

  async send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<T> {
    await this.ready;
    const id = this.nextId++;
    const command: CdpCommand = { id, method, params, sessionId };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(JSON.stringify(command));
    });
  }

  // Resolves on the next occurrence of `method` for the given session, with
  // a hard timeout — never wait unboundedly on a lifecycle event that might
  // not fire (matches docs/rules/05-worker-and-browser-pipeline.md §1's
  // "never networkidle as primary, always a bounded wait" spirit, applied
  // to the local path's own navigation wait here).
  waitForEvent(
    method: string,
    sessionId: string | undefined,
    timeoutMs: number,
  ): Promise<Record<string, unknown>> {
    const key = eventKey(method, sessionId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const listeners = this.eventListeners.get(key);
        if (listeners) {
          const idx = listeners.indexOf(handler);
          if (idx >= 0) listeners.splice(idx, 1);
        }
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for CDP event ${method}`));
      }, timeoutMs);

      const handler = (params: Record<string, unknown>): void => {
        clearTimeout(timeout);
        const listeners = this.eventListeners.get(key);
        if (listeners) {
          const idx = listeners.indexOf(handler);
          if (idx >= 0) listeners.splice(idx, 1);
        }
        resolve(params);
      };

      const existing = this.eventListeners.get(key) ?? [];
      existing.push(handler);
      this.eventListeners.set(key, existing);
    });
  }

  close(): void {
    this.ws.close();
  }
}

function eventKey(method: string, sessionId: string | undefined): string {
  return `${sessionId ?? ''}:${method}`;
}

export interface ScreenshotOptions {
  fullPage: boolean;
}

export interface HeadlessShellPage {
  navigate(url: string, timeoutMs: number): Promise<void>;
  screenshot(opts: ScreenshotOptions): Promise<Buffer>;
  /** Runtime.evaluate in the page's main world — used by inspect_ui/extract_assets extractors. */
  evaluate<T>(expression: string): Promise<T>;
  /**
   * Convenience wrapper over evaluate(): serializes `fn` and `args` and
   * invokes `fn(args)` in the page — the same shape Patchright/Playwright's
   * page.evaluate(fn, arg) offers, ported to raw CDP's expression-string
   * form so packages/worker's extractor logic can be carried over near
   * verbatim (see src/extractors/design-tokens.ts, assets.ts).
   */
  evaluateFn<T, A>(fn: (args: A) => T, args: A): Promise<T>;
  /**
   * Dispatches a real wheel event at the viewport center via CDP
   * Input.dispatchMouseEvent — used by the local motion-capture extractor's
   * scroll sampling (see ../extractors/motion-capture.ts's header comment
   * for why a real wheel event, not a programmatic scrollTop change).
   */
  wheel(deltaX: number, deltaY: number): Promise<void>;
  close(): Promise<void>;
}

export interface HeadlessShellBrowser {
  newPage(): Promise<HeadlessShellPage>;
  close(): Promise<void>;
}

class Page implements HeadlessShellPage {
  constructor(
    private readonly conn: CdpConnection,
    private readonly sessionId: string,
    private readonly targetId: string,
  ) {}

  async navigate(url: string, timeoutMs: number): Promise<void> {
    const loadEvent = this.conn.waitForEvent(
      'Page.domContentEventFired',
      this.sessionId,
      timeoutMs,
    );
    const result = await this.conn.send<{ errorText?: string }>(
      'Page.navigate',
      { url },
      this.sessionId,
    );
    if (result.errorText) {
      throw new Error(`Navigation failed: ${result.errorText}`);
    }
    await loadEvent;
  }

  async screenshot(opts: ScreenshotOptions): Promise<Buffer> {
    const params: Record<string, unknown> = { format: 'png' };

    if (opts.fullPage) {
      const metrics = await this.conn.send<{
        cssContentSize: { width: number; height: number };
      }>('Page.getLayoutMetrics', {}, this.sessionId);
      params.captureBeyondViewport = true;
      params.clip = {
        x: 0,
        y: 0,
        width: metrics.cssContentSize.width,
        height: metrics.cssContentSize.height,
        scale: 1,
      };
    }

    const result = await this.conn.send<{ data: string }>(
      'Page.captureScreenshot',
      params,
      this.sessionId,
    );
    return Buffer.from(result.data, 'base64');
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.conn.send<{
      result: { value?: T };
      exceptionDetails?: { text: string };
    }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, this.sessionId);
    if (result.exceptionDetails) {
      throw new Error(`Page evaluation failed: ${result.exceptionDetails.text}`);
    }
    return result.result.value as T;
  }

  async evaluateFn<T, A>(fn: (args: A) => T, args: A): Promise<T> {
    // JSON round-trip for args mirrors what Patchright/Playwright's own
    // evaluate(fn, arg) does under the hood (structured-clone-like args
    // serialization) — args here are always plain JSON-shaped config
    // objects (max counts, boolean flags), never functions/DOM nodes.
    return this.evaluate<T>(`(${fn.toString()})(${JSON.stringify(args)})`);
  }

  async wheel(deltaX: number, deltaY: number): Promise<void> {
    const { innerWidth, innerHeight } = await this.evaluate<{
      innerWidth: number;
      innerHeight: number;
    }>('({ innerWidth: window.innerWidth, innerHeight: window.innerHeight })');
    const x = innerWidth / 2;
    const y = innerHeight / 2;
    await this.conn.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseWheel', x, y, deltaX, deltaY },
      this.sessionId,
    );
  }

  async close(): Promise<void> {
    await this.conn.send('Target.closeTarget', { targetId: this.targetId });
  }
}

class Browser implements HeadlessShellBrowser {
  constructor(private readonly conn: CdpConnection) {}

  async newPage(): Promise<HeadlessShellPage> {
    const { targetId } = await this.conn.send<{ targetId: string }>('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await this.conn.send<{ sessionId: string }>('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await this.conn.send('Page.enable', {}, sessionId);
    return new Page(this.conn, sessionId, targetId);
  }

  async close(): Promise<void> {
    // Does not kill the OS process — the supervisor owns that (Terminate()
    // over IPC). This only closes this Node process's CDP connection to it.
    this.conn.close();
  }
}

/**
 * Connects to an already-running chrome-headless-shell's DevTools endpoint.
 * The process itself is spawned/killed by the Go supervisor
 * (supervisor/browser.go) — call this with the `cdpUrl` from its IPC
 * response (see ../supervisor/client.ts), not with a path to spawn.
 */
export async function connectHeadlessShell(cdpUrl: string): Promise<HeadlessShellBrowser> {
  const conn = new CdpConnection(cdpUrl);
  return new Browser(conn);
}
