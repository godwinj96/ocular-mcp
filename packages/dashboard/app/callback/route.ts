// OAuth callback target. Must match NEXT_PUBLIC_WORKOS_REDIRECT_URI and the
// redirect URI registered on the WorkOS AuthKit tenant — see
// node_modules/@workos-inc/authkit-nextjs's README "Callback route".
import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth({ returnPathname: '/' });
