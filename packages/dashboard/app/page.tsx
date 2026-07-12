// Authenticated home. middleware.ts's middlewareAuth already redirects
// unauthenticated visitors to AuthKit before this ever renders — "/" is not
// in unauthenticatedPaths — so withAuth() here is a read of an already-
// guaranteed session, not a re-check.
import Link from 'next/link';
import { withAuth, signOut } from '@workos-inc/authkit-nextjs';

export default async function HomePage() {
  const { user } = await withAuth();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-text-primary">
        Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
      </h1>
      <p className="mt-2 text-text-secondary">{user?.email}</p>

      <nav className="mt-10 grid gap-4 sm:grid-cols-3">
        <Link
          href="/keys"
          className="rounded-xl border border-border bg-surface-elevated p-5 transition hover:border-accent"
        >
          <p className="font-semibold text-text-primary">API Keys</p>
          <p className="mt-1 text-sm text-text-secondary">Generate, list, and revoke static keys.</p>
        </Link>
        <Link
          href="/quota"
          className="rounded-xl border border-border bg-surface-elevated p-5 transition hover:border-accent"
        >
          <p className="font-semibold text-text-primary">Quota</p>
          <p className="mt-1 text-sm text-text-secondary">Remaining renders and reset date.</p>
        </Link>
        <Link
          href="/billing"
          className="rounded-xl border border-border bg-surface-elevated p-5 transition hover:border-accent"
        >
          <p className="font-semibold text-text-primary">Billing</p>
          <p className="mt-1 text-sm text-text-secondary">Plan status and subscription management.</p>
        </Link>
      </nav>

      <form
        className="mt-10"
        action={async () => {
          'use server';
          await signOut();
        }}
      >
        <button type="submit" className="text-sm text-text-secondary underline hover:text-text-primary">
          Sign out
        </button>
      </form>
    </main>
  );
}
