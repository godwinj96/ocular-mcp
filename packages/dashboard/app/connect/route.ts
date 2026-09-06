// The one browser visit. See docs/design/first-run-auth-and-payment.md §4.2-4.3.
//
// The local worker opens THIS route, not AuthKit directly, because payment
// has to happen before a credential is issued and this app is what owns
// sign-in, subscription state, and checkout. The sequence is:
//
//   1. validate the loopback redirect target      (security-critical, see below)
//   2. persist the request                        (must outlive the sign-in trip)
//   3. require an AuthKit session                 (getCurrentAccount)
//   4. if the subscription is not active -> checkout, resume here afterwards
//   5. otherwise bounce to AuthKit /authorize with the worker's PKCE challenge
//
// Step 5 is silent: the user already has an AuthKit session by then, so they
// are not asked to sign in a second time. From their side it is one visit
// that ends with "this machine is connected".
//
// Step 2 exists because of a real production failure. This route was
// originally covered by middlewareAuth, so the sign-in bounce happened BEFORE
// the handler ran and the PKCE parameters had to survive AuthKit's
// `returnPathname` — which carries a pathname, not a query string. The first
// real run of the flow came back as "code_challenge is required". /connect is
// now in middleware's unauthenticatedPaths so this handler controls the
// ordering; it still requires a session, via getCurrentAccount below.
//
// This route NEVER sees the code_verifier — only the challenge, which is a
// SHA-256 hash. It therefore cannot mint tokens for the user, which is the
// entire point of PKCE and is why the worker can trust this hop.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentAccount } from '../../lib/current-account';
import { validateLoopbackRedirect } from '../../lib/loopback-redirect';
import { RESUME_COOKIE, parseResumeCookie } from '../../lib/connect-resume';

const RESUME_TTL_S = 15 * 60;

/** Cheapest plan — "$2.50/mo, cancel any time". Pay-first, no trial. */
const DEFAULT_TIER = 'basic';
const DEFAULT_CYCLE = 'monthly';

const AUTHORIZE_URL = 'https://api.workos.com/user_management/authorize';

interface ConnectRequest {
  redirectUri: string;
  codeChallenge: string;
  state: string;
}

function parseConnectRequest(url: URL): ConnectRequest | { error: string } {
  // Validate the redirect target FIRST. It is the only parameter that can
  // cause harm on its own: it tells AuthKit where to deliver an
  // authorization code, so an unchecked value is a credential-exfiltration
  // sink, not merely an open redirect.
  const redirect = validateLoopbackRedirect(url.searchParams.get('redirect_uri'));
  if (!redirect.ok) return { error: redirect.reason };

  const codeChallenge = url.searchParams.get('code_challenge');
  const state = url.searchParams.get('state');
  const method = url.searchParams.get('code_challenge_method');

  if (!codeChallenge) return { error: 'code_challenge is required' };
  if (!state) return { error: 'state is required' };
  // Refuse "plain" explicitly rather than silently upgrading it — a client
  // asking for plain is either very old or being downgraded.
  if (method && method !== 'S256') {
    return { error: 'code_challenge_method must be S256' };
  }

  return { redirectUri: redirect.redirectUri, codeChallenge, state };
}

function buildAuthorizeRedirect(request: ConnectRequest, clientId: string): string {
  const authorize = new URL(AUTHORIZE_URL);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', request.redirectUri);
  authorize.searchParams.set('code_challenge', request.codeChallenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('state', request.state);
  authorize.searchParams.set('provider', 'authkit');
  return authorize.toString();
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const jar = await cookies();

  // Parse from the query string, falling back to the stored request.
  //
  // The fallback is not belt-and-braces, it is load-bearing: this route is
  // reached again after a sign-in round trip, and AuthKit's `returnPathname`
  // carries a PATHNAME — the query string does not survive it. Without the
  // cookie the flow comes back as "code_challenge is required", which is
  // exactly how this failed in production the first time it was run.
  const fromQuery = parseConnectRequest(url);
  const parsed =
    'error' in fromQuery ? parseResumeCookie(jar.get(RESUME_COOKIE)?.value) : fromQuery;

  if (!parsed) {
    // Plain text and no redirect: if the target was the invalid part, we must
    // not bounce anywhere at all.
    const reason = 'error' in fromQuery ? fromQuery.error : 'no pending connect request';
    return new Response(`Invalid connect request: ${reason}`, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId) {
    return new Response('Sign-in is not configured on this deployment.', { status: 500 });
  }

  // Persist BEFORE authenticating. getCurrentAccount() redirects to sign-in
  // when there is no session, and the request has to outlive that trip.
  // /connect is in middleware's unauthenticatedPaths precisely so this runs
  // first — the route still requires a session, it just controls the order.
  jar.set(RESUME_COOKIE, JSON.stringify(parsed), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: RESUME_TTL_S,
  });

  const account = await getCurrentAccount();

  if (account.subscriptionStatus !== 'active') {
    // Pay-first, by design. The request is already stored, so the same
    // browser visit continues after checkout instead of making the user
    // re-run the CLI.
    redirect(`/billing/checkout?tier=${DEFAULT_TIER}&cycle=${DEFAULT_CYCLE}`);
  }

  // Active subscription: the request has served its purpose, so drop it
  // before completing the bounce.
  jar.delete(RESUME_COOKIE);
  redirect(buildAuthorizeRedirect(parsed, clientId));
}
