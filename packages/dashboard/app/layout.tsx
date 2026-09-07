import type { ReactNode } from 'react';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { AppBar } from '../components/app-bar';
import { QueryProvider } from '../components/query-provider';
import { ensureAccount } from '../lib/accounts';

// THE FONTS. This package shipped zero font files: layout.tsx asked for
// `font-display`, which resolves to "Geist Sans", which was never fetched
// anywhere in the dashboard -- so every surface has been rendering in
// system-ui while the website renders Geist. Nobody spotted it because
// system-ui on macOS is a perfectly nice typeface; it just isn't ours.
//
// @fontsource rather than next/font/google: it self-hosts real woff2 with
// font-display: swap and no external request, and -- the reason that decides
// it -- both packages then ship BYTE-IDENTICAL faces, which next/font/google
// cannot guarantee against the website's fontsource build.
//
// Geist Sans 500 is not optional. Per CSS font matching, a requested 500 with
// no 500 face falls back to 400: the website shipped `font-medium` for four
// rounds before anyone noticed every one of them was rendering at 400.
// Everything titled in this dashboard is 500.
//
// 700 and Outfit 400 are deliberately NOT loaded. Nothing here is bold, and
// Outfit's only job on this surface is button labels at 600.
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@ocular/design-tokens/tokens.css';
import './globals.css';

export const metadata = {
  title: 'Ocular',
  description: 'Your Ocular account.',
  // Matches --surface-base. The old value was inherited from a palette that no
  // longer exists anywhere in the product.
  themeColor: '#09090b',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The bar needs an identity to render. Every route except the handful listed
  // in middleware.ts is already behind middlewareAuth, so this is a read of a
  // session that is guaranteed to exist -- not a second auth check.
  // withAuth() WITHOUT ensureSignedIn on purpose: this layout also wraps the
  // unauthenticated paths (/login, /callback), and a redirecting read here
  // would loop them. ensureAccount is the same idempotent first-login
  // provisioning every protected page already performs.
  const { user } = await withAuth();
  const account = user ? await ensureAccount(user.id, user.email) : null;

  return (
    <html lang="en" className="font-display">
      <body>
        <AuthKitProvider>
          <QueryProvider>
            {user && <AppBar email={user.email ?? null} isAdmin={account?.role === 'admin'} />}
            <main className="mx-auto w-full max-w-app px-app pb-24 pt-10">{children}</main>
          </QueryProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}
