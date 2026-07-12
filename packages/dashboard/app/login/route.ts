// AuthKit sign-in entry point. See node_modules/@workos-inc/authkit-nextjs's
// README "Get the current user in a server component" pattern for
// getSignInUrl(). This route exists so the website's pricing CTA (and any
// other "Connect Ocular" link) has one stable path to send users to.
import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export async function GET() {
  const signInUrl = await getSignInUrl();
  redirect(signInUrl);
}
