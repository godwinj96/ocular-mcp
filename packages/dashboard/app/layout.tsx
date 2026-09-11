import type { ReactNode } from 'react';

import { SITE_URL } from '../lib/site';

// THE FONTS. This package shipped zero font files: layout.tsx asked for
// `font-display`, which resolves to "Geist Sans", which was never fetched
// anywhere in the dashboard -- so every surface has been rendering in
// system-ui while the website renders Geist. Nobody spotted it because
// system-ui on macOS is a perfectly nice typeface; it just isn't ours.
//
// @fontsource rather than next/font/google: it self-hosts real woff2 with
// font-display: swap and no external request, and -- the reason that decides
// it -- both packages then ship BYTE-IDENTICAL faces, which next/font/google
// cannot guarantee against the website's fontsource build.
//
// Geist Sans 500 is not optional. Per CSS font matching, a requested 500 with
// no 500 face falls back to 400: the website shipped `font-medium` for four
// rounds before anyone noticed every one of them was rendering at 400.
// Everything titled in this dashboard is 500.
//
// 700 is deliberately NOT loaded. Nothing here is bold.
//
// Outfit 400 IS loaded, unlike before the marketing site moved in. The
// dashboard alone only ever needed Outfit at 600 for button labels, and this
// file said so. The marketing surface uses `font-brand` at 400 for body-voice
// copy (hero deck, SectionHeader decks), and per the same CSS font-matching
// rule quoted above, a requested 400 with only a 600 face loaded does not
// fail loudly -- it silently renders the wrong weight. That is exactly the
// four-round bug described above, so it gets the fix rather than a repeat.
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@ocular/design-tokens/tokens.css';
import './globals.css';

// THE ROOT LAYOUT OWNS NO AUTH, DELIBERATELY, AND THIS IS LOAD-BEARING.
//
// It used to call withAuth() + ensureAccount() here, which was correct when
// every route in this app was an authenticated one. It no longer is: the
// marketing site and the blog live in (marketing), and a session read in a
// layout that wraps them would opt every one of those routes into dynamic
// rendering. Statically-rendered HTML is the entire reason those pages moved
// into this app -- crawlers that do not execute JavaScript (GPTBot,
// ClaudeBot, PerplexityBot among them) see only what the server sent.
//
// So auth lives in (app)/layout.tsx now, wrapping exactly the routes that
// need it and none of the ones that must stay static. If you are adding a
// session read, a cookie read, or an uncached fetch to THIS file, it belongs
// one level down instead -- check the build output afterwards either way:
// any (marketing) route printing `f` rather than `o`/`*` means it leaked.
//
// Metadata is per-group rather than global for the same reason it always
// should have been: the old value here was `title: 'Ocular'` /
// `description: 'Your Ocular account.'`, which is true of the dashboard and
// false of every marketing page. themeColor is the one genuinely app-wide
// value, so it is the one that stays.
// themeColor lives in `viewport`, not `metadata`. Next 15 moved it and warns
// once per route otherwise -- it was warning on all of them, since every route
// inherits this layout.
//
// Matches --surface-base. The old value was inherited from a palette that no
// longer exists anywhere in the product.
export const viewport = {
  themeColor: '#09090b',
};

// metadataBase is the one metadata field that genuinely belongs to the whole
// host: it is what lets per-page `openGraph.images: '/og-image.png'` resolve
// to an absolute URL, which OG and Twitter cards require. Without it Next
// warns and emits a relative path that no crawler can fetch.
//
// www, not the apex, and that is settled by evidence rather than taste: the
// apex 308-redirects to www (confirmed live -- see lib/public-cors.ts, which
// had to allowlist both origins for exactly this reason). A canonical tag
// must name the URL that actually serves, never one that redirects, and the
// per-page `alternates.canonical` values in (marketing)/page.tsx and
// (marketing)/setup/page.tsx are relative -- so they resolve against this one
// line. Getting it wrong here is one line now and a re-indexing problem once
// the marketing pages are live on this host.
export const metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="font-display">
      <body>{children}</body>
    </html>
  );
}
