// Caches the Node-side CDP connection keyed by the supervisor's current
// cdpUrl. The supervisor hands back a (possibly new) cdpUrl on every
// capture_start response (see ../supervisor/client.ts) — if it matches the
// cached one, the browser is still the same warm process and the existing
// connection is reused; if it changed (the browser was restarted, e.g.
// after an idle-shutdown-then-rewarm cycle), the stale connection is
// closed and a fresh one opened. This is what keeps Node's view of the
// browser correct without needing a push channel from Go.

import { connectHeadlessShell, type HeadlessShellBrowser } from './headless-shell.js';

let cached: { cdpUrl: string; browser: HeadlessShellBrowser } | null = null;

export async function getBrowserSession(cdpUrl: string): Promise<HeadlessShellBrowser> {
  if (cached && cached.cdpUrl === cdpUrl) {
    return cached.browser;
  }
  if (cached) {
    await cached.browser.close().catch(() => undefined);
    cached = null;
  }
  const browser = await connectHeadlessShell(cdpUrl);
  cached = { cdpUrl, browser };
  return browser;
}

/** Test/shutdown hook — drops the cache without closing (caller's responsibility). */
export function resetBrowserSessionCache(): void {
  cached = null;
}
