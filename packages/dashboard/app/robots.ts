import type { MetadataRoute } from 'next';

import { SITE_URL } from '../lib/site';

// A robots.txt is a NEW requirement created by the marketing migration, not a
// port of the old one. The standalone Vite site said `Allow: /` and meant it:
// every route it served was public marketing. This host is not that -- the
// same deployment now serves /billing, /admin, /usage and an account
// dashboard alongside the homepage. Without the disallow list below, the
// first crawl after the domain moves would walk straight into them.
//
// What a crawler actually gets on those paths is an AuthKit redirect, not
// data -- middleware.ts is secure-by-default. So this is not the access
// control; middleware is. It is index hygiene: sign-in bounces indexed under
// the brand's own domain, /billing surfacing in a site: search, and crawl
// budget spent on routes that can never return content.
//
// The old robots.txt advertised https://www.useocular.dev/sitemap.xml, which
// has never existed. app/sitemap.ts finally makes that reference true.
//
// File-convention route at the app root: route groups like (app) and
// (marketing) do not affect its URL, so this serves at /robots.txt. It is
// listed in middleware.ts's unauthenticatedPaths for the same reason every
// public path is -- an unlisted one gets bounced, and a robots.txt that
// redirects to a login page is read as "no rules".
const DISALLOWED = [
  // The authenticated product surface.
  '/dashboard',
  '/access',
  '/activity',
  '/billing',
  '/usage',
  '/admin',

  // Auth plumbing. /login is a redirect into AuthKit and /callback only ever
  // makes sense mid-flow with a code in the query string.
  '/login',
  '/callback',

  // /connect is the local worker's pairing handshake -- a browser lands here
  // once, carrying PKCE parameters, and never by search.
  '/connect',

  // Machine-to-machine: Bachs's webhook (HMAC-verified) and the API routes,
  // including the public ones. /api/public/* is public in the sense that the
  // marketing page's own JavaScript calls it, not in the sense that a search
  // result should point at a JSON body.
  '/webhooks/',
  '/api/',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: DISALLOWED,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
