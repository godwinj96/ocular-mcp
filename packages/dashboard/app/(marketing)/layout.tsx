import type { ReactNode } from 'react';
import { Nav } from '../../components/marketing/nav';
import './marketing.css';
import './specimen.css';

// The public surface: the marketing homepage, /setup, and the blog.
//
// What this layout deliberately does NOT do is the whole reason it exists.
// No withAuth(), no ensureAccount(), no AuthKitProvider, no QueryProvider, no
// AppBar -- nothing that reads a session, a cookie, or a header. Any one of
// those would opt every route below into dynamic rendering, and these routes
// exist to be static: a crawler that does not execute JavaScript has to see
// the finished HTML or it sees nothing at all.
//
// The check that this is still true is mechanical, not a matter of opinion:
// `next build` must print these routes as static, and `curl` on a built page
// must return the actual copy. If either stops being true, something in here
// or in a component it renders started reading request state.
//
// `marketing-shell` is not decorative. marketing.css keys its two would-be
// global rules (smooth scrolling, anchor scroll-margin) off this class,
// because Next does not scope a stylesheet to the routes that import it --
// unscoped, they would have applied to the dashboard as well.
//
// Nav lives here rather than in each page, matching the Vite site's
// root-layout. CtaFooter deliberately does NOT: only the homepage renders it,
// exactly as before -- /setup has never had a footer.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell min-h-screen overflow-x-hidden">
      <Nav />
      <main>{children}</main>
    </div>
  );
}
