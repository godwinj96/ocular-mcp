import type { ReactNode } from 'react';

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
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen overflow-x-hidden">{children}</div>;
}
