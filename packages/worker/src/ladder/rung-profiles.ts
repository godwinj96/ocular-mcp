// Generates internally-coherent RungProfile bundles (UA/viewport/locale/timezone
// agreeing with the proxy's geo). See docs/rules/05-worker-and-browser-pipeline.md §2.
// Nothing downstream hand-assembles a profile.

import type { RungProfile } from '../providers/browser-provider.js';

export const RUNG_NAMES = ['dc-proxy', 'residential-proxy', 'camoufox', 'paid-unblocker'] as const;
export type RungName = (typeof RUNG_NAMES)[number];

const US_DESKTOP_CHROME_BUNDLE = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
} as const;

// Webshare's rotating-backbone connection format, confirmed against Webshare's
// own API docs (apidocs.webshare.io/proxy-connection, help.webshare.io's
// "Rotating Proxy Endpoint" article) rather than guessed:
//   http://{username}-rotate:{password}@p.webshare.io:80/  (residential, rotates per request)
//   http://{username}:{password}@p.webshare.io:80/         (datacenter, no -rotate suffix)
// WEBSHARE_PROXY_URL is the bare host:port (e.g. "p.webshare.io:80");
// WEBSHARE_PROXY_CREDENTIALS is "username:password" from the Webshare dashboard.
function webshareCredentials(): { username: string; password: string } | null {
  const raw = process.env.WEBSHARE_PROXY_CREDENTIALS;
  if (!raw) return null;
  const separatorIndex = raw.indexOf(':');
  if (separatorIndex < 0) {
    throw new Error('WEBSHARE_PROXY_CREDENTIALS must be "username:password"');
  }
  return { username: raw.slice(0, separatorIndex), password: raw.slice(separatorIndex + 1) };
}

function webshareServer(): string | null {
  const url = process.env.WEBSHARE_PROXY_URL;
  return url ? `http://${url}` : null;
}

// Rung 0 — datacenter proxy. Falls back to a coherent proxyless bundle (not a
// crash) when Webshare isn't configured, same behavior this rung has always
// had — rung 0 is meant to be the cheap, always-available first attempt.
function dcProxyProfile(): RungProfile {
  const server = webshareServer();
  const creds = webshareCredentials();
  if (!server || !creds) return { ...US_DESKTOP_CHROME_BUNDLE };
  return {
    ...US_DESKTOP_CHROME_BUNDLE,
    proxy: { server, username: creds.username, password: creds.password },
  };
}

// Rung 1 — residential proxy. DataImpulse (this rung's originally-planned
// vendor) is deferred — signup was blocked by a dedup false-positive and
// wasn't re-pursued once Webshare's own rotating-residential product covered
// the same need. Unlike rung 0, this rung has no meaningful proxyless
// fallback (that would just be rung 0 again) — not provisioned is a hard
// "not implemented", matching rungs 2-3's existing behavior below.
function residentialProxyProfile(): RungProfile {
  const server = webshareServer();
  const creds = webshareCredentials();
  if (!server || !creds) {
    throw new Error(
      "getRungProfile('residential-proxy') not implemented — Webshare not configured",
    );
  }
  return {
    ...US_DESKTOP_CHROME_BUNDLE,
    proxy: { server, username: `${creds.username}-rotate`, password: creds.password },
  };
}

export function getRungProfile(rung: RungName): RungProfile {
  if (rung === 'dc-proxy') return dcProxyProfile();
  if (rung === 'residential-proxy') return residentialProxyProfile();
  // Camoufox (rung 2) is explicitly deferred per the founder's launch-scope
  // call — no vendor/engine work pursued this pass. Rung 3 (paid-unblocker)
  // is not a BrowserProvider profile at all — see unblocker-client.ts.
  throw new Error(
    `getRungProfile('${rung}') not implemented — Camoufox (rung 2) deferred post-launch`,
  );
}
