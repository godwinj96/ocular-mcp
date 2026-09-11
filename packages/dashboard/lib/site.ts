// The canonical origin, in one place, because three separate files now need
// to agree on it: layout.tsx's metadataBase (which every page's relative
// canonical and OG URL resolves against), app/sitemap.ts (absolute URLs are
// required by the sitemap protocol), and app/robots.ts (the Sitemap: line).
// Three hand-typed copies is how a host fix lands in two of them.
//
// www, not the apex, and that is settled by evidence rather than taste: the
// apex 308-redirects to www, confirmed live -- see lib/public-cors.ts, which
// had to allowlist both origins for exactly that reason. A canonical tag, a
// sitemap entry and a Sitemap: line must all name the URL that actually
// serves, never one that redirects.
export const SITE_URL = 'https://www.useocular.dev';

// Every public path on this host. The marketing pages moved into this app so
// they could be server-rendered for crawlers; everything else here is behind
// AuthKit (see middleware.ts, which is secure-by-default) and must stay out
// of both the sitemap and the index.
//
// Adding a public marketing page means touching three files, and skipping any
// one of them is a silent failure: this list, middleware.ts's
// unauthenticatedPaths (or the page bounces every visitor and every bot to
// AuthKit), and the page's own metadata.
export const PUBLIC_PATHS = ['/', '/setup'] as const;
