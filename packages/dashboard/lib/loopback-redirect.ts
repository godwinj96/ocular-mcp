// Validation for the /connect route's `redirect_uri`. See
// docs/design/first-run-auth-and-payment.md §4.3 and §11.
//
// This is the security-critical part of the whole login flow, and it is
// deliberately its own module with its own tests rather than an inline check
// inside the route handler.
//
// /connect takes a redirect target from an untrusted query string and hands
// it to AuthKit as the place to deliver an authorization code. Without this
// guard that is a textbook open redirect AND a credential-exfiltration sink:
// an attacker who can get a signed-in user to open
//   /connect?redirect_uri=https://evil.example/callback&...
// receives a real authorization code for that user's account.
//
// So the rule is an allowlist, not a denylist: the target must be plain HTTP
// on an explicit loopback host with a port. Anything else is refused.

/** Only these hosts may receive an authorization code. Not a substring match. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export type RedirectValidation = { ok: true; redirectUri: string } | { ok: false; reason: string };

export function validateLoopbackRedirect(raw: string | null | undefined): RedirectValidation {
  if (!raw) return { ok: false, reason: 'redirect_uri is required' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'redirect_uri is not a valid URL' };
  }

  // http: only. https on loopback is not something the local worker can
  // serve, and allowing other schemes (javascript:, data:, file:, custom
  // app schemes) would open non-HTTP delivery paths for the code.
  if (url.protocol !== 'http:') {
    return { ok: false, reason: 'redirect_uri must use http on loopback' };
  }

  // url.hostname strips the brackets from an IPv6 literal, so check both forms.
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return { ok: false, reason: 'redirect_uri must point at a loopback address' };
  }

  // A missing port would mean port 80, which the local worker never binds and
  // which a privileged process could be squatting.
  if (!url.port) {
    return { ok: false, reason: 'redirect_uri must include the local port' };
  }

  // Credentials in the URL would be echoed onward by the redirect chain.
  if (url.username || url.password) {
    return { ok: false, reason: 'redirect_uri must not carry credentials' };
  }

  return { ok: true, redirectUri: url.toString() };
}
