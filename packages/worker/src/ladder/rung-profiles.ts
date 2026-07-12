// Generates internally-coherent RungProfile bundles (UA/viewport/locale/timezone
// agreeing with the proxy's geo). See docs/rules/05-worker-and-browser-pipeline.md §2.
// Nothing downstream hand-assembles a profile.

import type { RungProfile } from '../providers/browser-provider.js';

export const RUNG_NAMES = ['dc-proxy', 'residential-proxy', 'camoufox', 'paid-unblocker'] as const;
export type RungName = (typeof RUNG_NAMES)[number];

// Rung 0 (dc-proxy) is the only rung with a real profile today — Webshare
// (rung 0's intended proxy vendor) and DataImpulse (rung 1) accounts are not
// yet provisioned (see DEVLOG M3), so this rung runs proxyless with a
// coherent US-desktop-Chrome bundle instead of a mismatched fingerprint.
// Every field agrees (UA <-> viewport <-> locale <-> timezone) per the rule
// in docs/rules/05-worker-and-browser-pipeline.md §2.
const DC_PROXY_PROFILE: RungProfile = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
};

export function getRungProfile(rung: RungName): RungProfile {
  if (rung === 'dc-proxy') {
    return DC_PROXY_PROFILE;
  }
  // TODO(M3): build a coherent bundle from the proxy pool's exit geo for this
  // rung (DataImpulse for rung 1, Camoufox for rung 2, Decodo for rung 3).
  // Requires proxy vendor accounts, not yet provisioned.
  throw new Error(`getRungProfile('${rung}') not implemented — see M3 in DEVLOG.md`);
}
