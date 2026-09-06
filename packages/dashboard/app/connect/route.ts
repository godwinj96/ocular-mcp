// The one browser visit. See docs/design/first-run-auth-and-payment.md §4.2-4.3.
//
// The local worker opens THIS route, not AuthKit directly, because payment
// has to happen before a credential is issued and this app is what owns
// sign-in, subscription state, and checkout. The sequence is:
//
//   1. validate the loopback redirect target      (security-critical, see below)
//   2. require an AuthKit session                 (getCurrentAccount)
//   3. if the subscription is not active -> checkout, resume here afterwards
//   4. otherwise bounce to AuthKit /authorize with the worker's PKCE challenge
//
// Step 4 is silent: the user already has an AuthKit session by then, so they
// are not asked to sign in a second time. From their side it is one visit
// that ends with "this machine is connected".
//
// This route NEVER sees the code_verifier — only the challenge, which is a
// SHA-256 hash. It therefore cannot mint tokens for the user, which is the
// entire point of PKCE and is why the worker can trust this hop.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentAccount } from '../../lib/current-account';
import { validateLoopbackRedirect } from '../../lib/loopback-redirect';

/** Carries the pending connect request across the checkout round-trip. */
const RESUME_COOKIE = 'ocular_connect';
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
  const parsed = parseConnectRequest(url);

  if ('error' in parsed) {
    // Plain text and no redirect: if the target was the invalid part, we must
    // not bounce anywhere at all.
    return new Response(`Invalid connect request: ${parsed.error}`, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId) {
    return new Response('Sign-in is not configured on this deployment.', { status: 500 });
  }

  // Redirects to AuthKit sign-in when there is no session, then returns here.
  const account = await getCurrentAccount();

  if (account.subscriptionStatus !== 'active') {
    // Pay-first, by design. Stash the request so the same browser visit can
    // continue after checkout instead of making the user re-run the CLI.
    const jar = await cookies();
    jar.set(RESUME_COOKIE, JSON.stringify(parsed), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: RESUME_TTL_S,
    });
    redirect(`/billing/checkout?tier=${DEFAULT_TIER}&cycle=${DEFAULT_CYCLE}`);
  }

  // Active subscription: clear any stale resume state and complete the bounce.
  const jar = await cookies();
  jar.delete(RESUME_COOKIE);

  redirect(buildAuthorizeRedirect(parsed, clientId));
}
