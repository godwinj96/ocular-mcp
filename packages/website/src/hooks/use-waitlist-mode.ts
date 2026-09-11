import { useEffect, useState } from 'react';

// Shared by every CTA on the site (hero, nav, cta-footer, pricing) so the
// flag is fetched once per page load, not once per CTA instance -- four
// independent fetches on mount would be wasteful and could race to
// different answers if the toggle flips mid-load.
//
// See packages/dashboard/app/api/public/waitlist-status/route.ts for the
// endpoint and lib/feature-flags.ts for what sets it. Runtime, not
// build-time, deliberately: the website is a static Vite SPA with no server
// to bake a flag into, and the whole point of an admin toggle is not
// needing a rebuild+redeploy to take effect.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001';

// null = not resolved yet. Consumers that can't show a stable-sized loading
// placeholder (a compact nav pill, an inline hero link) can just treat null
// the same as false -- the normal CTA renders first and swaps to "Join
// waitlist" once the fetch resolves, which in practice is a sub-100ms flash
// at most, not a jarring wait. Pricing's own CTA (the one with an inline
// form to size for) reserves its footprint during null instead.
export function useWaitlistMode(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DASHBOARD_URL}/api/public/waitlist-status`)
      .then((res) => (res.ok ? res.json() : { waitlistMode: false }))
      .then((data: { waitlistMode?: boolean }) => {
        if (!cancelled) setEnabled(Boolean(data.waitlistMode));
      })
      // A failed flag check must never block a CTA -- fail open to the
      // normal checkout path, same "advisory, not load-bearing" posture
      // the local worker's own heartbeat takes on a failed request.
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}

export { DASHBOARD_URL };
