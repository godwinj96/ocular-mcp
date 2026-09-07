import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getCurrentAccount } from '../../lib/current-account';
import { AdminRail, AdminMobileNav } from '../../components/admin/admin-rail';

// The ONE shared auth gate for every /admin/* route -- moved here from
// individual pages so all five sections are gated identically. This does
// NOT relax the "every mutation re-checks role independently" rule (see
// app/admin/actions.ts's header): a layout-level check stops an
// unauthorized page RENDER, but a Server Action can be invoked directly
// without ever rendering this layout, so every mutation still checks for
// itself. Belt AND suspenders, not one instead of the other.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const account = await getCurrentAccount();

  // notFound() rather than a 403 page: an admin surface should not confirm
  // its own existence to someone who cannot use it — same reasoning the
  // single-lookup page this replaces already stated.
  if (account.role !== 'admin') notFound();

  return (
    <div>
      <AdminMobileNav />
      <div className="flex items-start gap-8">
        <AdminRail />
        <div className="min-w-0 flex-1 py-8">{children}</div>
      </div>
    </div>
  );
}
