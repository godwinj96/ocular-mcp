'use client';

import { useEffect, useState } from 'react';

// Shared by every CTA on the site (hero, nav, cta-footer, pricing) so the
// flag is fetched once per page load, not once per CTA instance -- four
// independent fetches on mount would be wasteful and could race to
// different answers if the toggle flips mid-load.
//
// See app/(app)/api/public/waitlist-status/route.ts for the endpoint and
// lib/feature-flags.ts for what sets it.
//
// STILL A CLIENT FETCH, AND NOW ON PURPOSE RATHER THAN BY CONSTRAINT.
// It used to be one because the website was a static Vite SPA with no server
// of its own. That reason is gone -- this is a Next app and the flag could be
// read server-side -- but a better one replaced it: reading it in a Server
// Component would make every page that renders a CTA dynamic, and the
// marketing pages exist to be statically generated for crawlers that do not
// run JavaScript. A per-request DB read in the layout would quietly undo
// that. So the HTML stays static and the flag arrives on hydration.
//
// The URL is relative now, which is the one thing the move does change:
// same-origin, so it no longer depends on the CORS allowlist in
// lib/public-cors.ts, and there is no build-time env var pointing at another
// deployment. That allowlist still matters for anything else calling these
// routes cross-origin -- don't delete it on account of this file.
const WAITLIST_STATUS_PATH = '/api/public/waitlist-status';

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
    fetch(WAITLIST_STATUS_PATH)
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

// Where "Choose a plan" sends someone. /dashboard is behind auth, so an
// anonymous visitor gets the sign-in bounce and lands on their account after
// -- which is exactly what clicking the old absolute dashboard URL did.
export const CHECKOUT_PATH = '/dashboard';

// The waitlist signup endpoint, same origin for the same reason as above.
export const WAITLIST_SUBMIT_PATH = '/api/public/waitlist';
