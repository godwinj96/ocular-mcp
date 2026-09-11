'use client';

import { useEffect, useState } from 'react';

// Shared by every CTA on the site (hero, nav, cta-footer, pricing) so the
// flag is fetched once per page load, not once per CTA instance -- four
// independent fetches on mount would be wasteful and could race to
// different answers if the toggle flips mid-load.
//
// That sharing is what the module-level cache below actually provides. It did
// not before: this comment described the intent while every consumer owned its
// own useState/useEffect, so a page load fired four identical requests (nav,
// hero's ConnectCta, pricing's WaitlistCta, cta-footer's ConnectCta --
// observed in the network panel). A module-level promise is the right shape
// rather than a context provider, which would mean making the marketing
// layout a client component for the sake of one boolean.
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

// The one in-flight request, shared by every consumer that mounts while it is
// pending. Module scope, so its lifetime is the page load -- a client-side
// navigation within the app reuses the answer rather than re-asking.
let inFlight: Promise<boolean> | null = null;

// The resolved answer, so a CTA mounting AFTER the fetch settles (anything
// rendered on a later client-side navigation) gets it synchronously instead
// of flashing the null state again. Null during the initial hydration pass,
// when every consumer mounts together and the fetch has not resolved yet --
// so the first client render still matches the server HTML.
let resolved: boolean | null = null;

function loadWaitlistMode(): Promise<boolean> {
  inFlight ??= fetch(WAITLIST_STATUS_PATH)
    .then((res) => (res.ok ? res.json() : { waitlistMode: false }))
    .then((data: { waitlistMode?: boolean }) => {
      resolved = Boolean(data.waitlistMode);
      return resolved;
    })
    // A failed flag check must never block a CTA -- fail open to the
    // normal checkout path, same "advisory, not load-bearing" posture
    // the local worker's own heartbeat takes on a failed request.
    //
    // The failure is not cached: clearing inFlight lets a later navigation
    // ask again rather than pinning the whole session to one lost packet.
    // Consumers already awaiting this promise still get false, which is the
    // fail-open answer they would have got anyway.
    .catch(() => {
      inFlight = null;
      return false;
    });

  return inFlight;
}

// null = not resolved yet. Consumers that can't show a stable-sized loading
// placeholder (a compact nav pill, an inline hero link) can just treat null
// the same as false -- the normal CTA renders first and swaps to "Join
// waitlist" once the fetch resolves, which in practice is a sub-100ms flash
// at most, not a jarring wait. Pricing's own CTA (the one with an inline
// form to size for) reserves its footprint during null instead.
export function useWaitlistMode(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(resolved);

  useEffect(() => {
    if (resolved !== null) return;

    let cancelled = false;
    // loadWaitlistMode never rejects -- it resolves false on failure -- so
    // there is no catch to add here.
    void loadWaitlistMode().then((value) => {
      if (!cancelled) setEnabled(value);
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
