// Session management via WorkOS AuthKit's Next.js middleware (Next.js <=16
// convention — see node_modules/@workos-inc/authkit-nextjs/README.md
// "Proxy / Middleware"). middlewareAuth.enabled=true makes every route
// protected by default except the ones explicitly listed as unauthenticated —
// "secure by default" fits an authenticated-surface package better than the
// per-page withAuth({ ensureSignedIn: true }) opt-in model.
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    // /webhooks/bachs is called by Bachs's servers, never a signed-in
    // browser — it authenticates the request itself via HMAC signature
    // verification (see app/webhooks/bachs/route.ts), not an AuthKit session.
    // /connect is listed here but is NOT public: it calls getCurrentAccount()
    // itself, which still requires a session. The difference is ordering.
    //
    // Under middleware auth it bounced to AuthKit before the route ran, and
    // the PKCE parameters had to survive a round trip through AuthKit's
    // `returnPathname` state — which strips the query string, so the flow
    // came back as "code_challenge is required". Handling auth inside the
    // route lets it validate and persist the request BEFORE any redirect,
    // which is what the design specified and what makes the parameters
    // survive.
    //
    // /api/internal/* is service-to-service — mcp-server, never a browser —
    // authenticated by a static shared secret the route checks itself (see
    // app/api/internal/worker-heartbeat/route.ts). An AuthKit bounce would
    // just break it, the same way it would have broken /connect.
    //
    // /api/public/* is called by the website — a different origin, never a
    // signed-in dashboard session — see lib/public-cors.ts for the CORS
    // allowlist these two routes apply themselves.
    //
    // The (marketing) group below is the public site -- homepage, /setup, and
    // the blog -- which moved into this app so it could be server-rendered for
    // crawlers. These MUST stay listed: middlewareAuth is secure-by-default,
    // so an unlisted marketing path does not merely get a slow session check,
    // it bounces the visitor (and every indexing bot) to AuthKit. Adding a
    // public page without adding it here is the failure mode to watch for.
    //
    // `/blog/:path*` uses the same glob syntax as the Next.js matcher, per
    // authkit-nextjs's README -- it covers post pages and their generated
    // opengraph-image routes. /sitemap.xml and /robots.txt are listed
    // explicitly because they share no prefix with anything else here.
    unauthenticatedPaths: [
      '/',
      '/setup',
      '/blog',
      '/blog/:path*',
      '/sitemap.xml',
      '/robots.txt',
      '/login',
      '/callback',
      '/webhooks/bachs',
      '/connect',
      '/api/internal/worker-heartbeat',
      '/api/public/waitlist-status',
      '/api/public/waitlist',
    ],
  },
});

// The extension exclusion is not cosmetic -- without it every static asset on
// the public site gets a 307 to AuthKit. Found by loading the ported homepage
// and watching the favicon, /og-image.png and /llms.txt all bounce: on the old
// Vite deployment these were plain files with no middleware in front of them,
// and nothing in the move makes that obvious until something tries to fetch
// one. A social card that resolves to a login page and an llms.txt no crawler
// can read are both silent failures -- they break nothing on screen.
//
// Extensions are listed rather than using a catch-all `\.[^.]+$`, deliberately:
// /admin/waitlist/export.csv is a real authenticated route, and a blanket
// any-extension rule would drop it out of middleware auth. It does check the
// session itself, but this file is secure-by-default and should stay that way
// rather than quietly delegating that to one route handler.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|txt|xml|json|woff|woff2|ttf|otf|webmanifest)$).*)',
  ],
};
