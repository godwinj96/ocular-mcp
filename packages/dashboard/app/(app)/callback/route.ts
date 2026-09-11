// OAuth callback target. Must match NEXT_PUBLIC_WORKOS_REDIRECT_URI and the
// redirect URI registered on the WorkOS AuthKit tenant — see
// node_modules/@workos-inc/authkit-nextjs's README "Callback route".
import { handleAuth } from '@workos-inc/authkit-nextjs';

// returnPathname is /dashboard, not /: the marketing homepage owns / since the
// site moved into this app, and landing a freshly signed-in user there instead
// of on their account would read as the login having failed.
export const GET = handleAuth({ returnPathname: '/dashboard' });
