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
    // Breaks out of the root layout's `mx-auto max-w-app` centered column —
    // see components/admin/admin-rail.tsx's own header for why admin is
    // deliberately NOT the same centered-document shape as every other page.
    // Without this, the rail sits nested inside that same centered ~1080px
    // column and reads as broken on any wider screen: a sidebar's entire
    // visual grammar promises "I'm at the edge," and a symmetric gutter in
    // front of it breaks that promise in a way a plain centered paragraph
    // never would (founder-reported: "floating towards the middle... the
    // white space to the left looks bad").
    //
    // Standard technique for a child to reach the true viewport width
    // regardless of an ancestor's own max-width: `left: 50%` shifts this
    // element's left edge to the PARENT's horizontal center — which, because
    // the parent (`<main>`) is itself centered on the viewport via
    // `mx-auto`, IS the viewport's own center, regardless of the parent's
    // capped width. `margin-left: -50vw` then pulls that back to the true
    // viewport left edge, and `w-screen` spans the full viewport width from
    // there. (Symmetric `px-app` padding on `<main>` doesn't shift this math
    // — padding narrows the content box without moving its center point.)
    <div className="relative left-1/2 w-screen -ml-[50vw]">
      <AdminMobileNav />
      <div className="flex items-start">
        <AdminRail />
        {/* Left-anchored, not centered, but still capped to a comfortable
            reading width — the same measure/inset tokens the rest of the
            app uses, just no longer competing with mx-auto for where they
            sit. */}
        <div
          className="min-w-0 flex-1 px-app py-8"
          style={{ maxWidth: 'calc(var(--app-measure) + 2 * var(--app-inset))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
