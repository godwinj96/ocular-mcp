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
    unauthenticatedPaths: [
      '/login',
      '/callback',
      '/webhooks/bachs',
      '/connect',
      '/api/internal/worker-heartbeat',
    ],
  },
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
