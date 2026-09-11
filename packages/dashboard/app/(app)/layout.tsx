import type { ReactNode } from 'react';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { AppBar } from '../../components/app-bar';
import { QueryProvider } from '../../components/query-provider';
import { ensureAccount } from '../../lib/accounts';

// The authenticated surface. Everything under (app) is the dashboard proper:
// /dashboard, /access, /activity, /admin, /billing, /usage, plus the auth and
// machine endpoints (/login, /callback, /connect, /api, /webhooks).
//
// This file is the old app/layout.tsx from the waist down. It moved here when
// the marketing site and blog came into this app: a session read in the ROOT
// layout would have wrapped those too and forced them to render dynamically,
// which would have defeated the point of moving them (see app/layout.tsx's
// own note). Nothing about the behaviour of the routes below changed in that
// move -- same providers, same bar, same main wrapper, same order.
//
// The route group parentheses mean this directory contributes NOTHING to the
// URL: (app)/access/page.tsx is still /access. Only the layout nesting
// changed.
export const metadata = {
  title: 'Ocular',
  description: 'Your Ocular account.',
};

export default async function AppLayout({ children }: { children: ReactNode }) {
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
    <AuthKitProvider>
      <QueryProvider>
        {user && <AppBar email={user.email ?? null} isAdmin={account?.role === 'admin'} />}
        <main className="mx-auto w-full max-w-app px-app pb-24 pt-10">{children}</main>
      </QueryProvider>
    </AuthKitProvider>
  );
}
