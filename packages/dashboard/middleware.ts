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
    unauthenticatedPaths: ['/login', '/callback', '/webhooks/bachs'],
  },
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
