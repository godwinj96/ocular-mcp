'use server';

import { signOut } from '@workos-inc/authkit-nextjs';

// Sign-out as a server action rather than a POST route handler. The account
// menu is a client component, so it cannot declare an inline 'use server'
// action the way app/page.tsx used to -- and a plain route handler would take
// a cross-site POST, which is logout CSRF. Next's server actions carry an
// origin check of their own.
//
// Where this lands after signing out is NOT decided here: AuthKit sends the
// user to the application's configured homepage URL. That field was null in
// WorkOS until this session, which is why signing out used to dead-end on
// error.workos.com/user_management/app-homepage-url-not-found. It is now
// https://useocular.dev -- the marketing site, because signing out and landing
// on a page that immediately demands sign-in again reads as a loop.
export async function signOutAction(): Promise<void> {
  await signOut();
}
