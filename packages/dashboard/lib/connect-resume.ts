// Resuming the first-run connect flow after the checkout round-trip. See
// docs/design/first-run-auth-and-payment.md §4.2 step 5.
//
// Bachs sends a paying user back to /billing?checkout=success, not to
// /connect, so without this the "one browser visit" promise would break at
// exactly the moment the user has just paid — the worst possible place to
// ask someone to go re-run a CLI command.
//
// The cookie is httpOnly and short-lived, but it is still ATTACKER-INFLUENCED
// INPUT: anything that can set a cookie on this origin can put a value here.
// So the stored redirect target is re-validated on the way out rather than
// trusted because we were the ones who wrote it.

import { validateLoopbackRedirect } from './loopback-redirect';

export const RESUME_COOKIE = 'ocular_connect';

export interface ResumedConnect {
  redirectUri: string;
  codeChallenge: string;
  state: string;
}

/**
 * Rebuilds the /connect URL to resume, or null when there is nothing valid to
 * resume. Never throws — a malformed cookie is a no-op, not a 500 on the page
 * a user lands on straight after paying.
 */
export function resumeConnectUrl(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = parsed as Record<string, unknown>;

  const { redirectUri, codeChallenge, state } = value;
  if (
    typeof redirectUri !== 'string' ||
    typeof codeChallenge !== 'string' ||
    typeof state !== 'string' ||
    !codeChallenge ||
    !state
  ) {
    return null;
  }

  // Re-validate. See header: writing this cookie ourselves is not proof that
  // this is the value we wrote.
  const redirect = validateLoopbackRedirect(redirectUri);
  if (!redirect.ok) return null;

  const url = new URL('/connect', 'https://placeholder.invalid');
  url.searchParams.set('redirect_uri', redirect.redirectUri);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  // Relative, so it works on any deployment host.
  return `${url.pathname}${url.search}`;
}
