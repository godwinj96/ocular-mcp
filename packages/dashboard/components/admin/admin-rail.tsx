import { ButtonLink } from '../ui/button';
import { AdminNavItem } from './admin-nav-item';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/audit', label: 'Audit log' },
] as const;

// A sidebar ONLY inside /admin/*, deliberately contradicting app-bar.tsx's
// own "no sidebar" reasoning -- and correctly so. That argument ("five
// destinations, no tree") is about DEPTH: the top bar's five destinations
// are flat, so a 240px rail would spend a fifth of the column encoding a
// hierarchy that doesn't exist. Admin's five destinations are ALSO flat --
// there's no third level under Users or Waitlist -- so this rail isn't
// earning its keep by encoding structure either. It's answering a different
// question: a rail is the signifier that you've entered a distinct
// operational surface, independent of whether that surface has a tree
// under it. See app/admin/layout.tsx for where the auth gate that makes
// this a real boundary (not just a visual one) lives.
export function AdminRail() {
  return (
    <div
      className="sticky hidden shrink-0 flex-col border-r border-rule-structural md:flex"
      style={{ top: 'var(--app-bar-h)', height: 'calc(100vh - var(--app-bar-h))', width: '220px' }}
    >
      <p className="px-4 pt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
        Admin
      </p>
      <nav
        aria-label="Admin"
        className="mt-stack-1 flex flex-col border-b border-rule-divider pb-2"
      >
        {LINKS.map((link) => (
          <AdminNavItem key={link.href} {...link} />
        ))}
      </nav>

      <div className="mt-auto border-t border-rule-divider p-3">
        <ButtonLink href="/" variant="quiet">
          ← Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

// Below md: a second horizontal scrollable link row under the bar's own
// mobile row, rather than a persistent left column eating phone-width
// viewport for chrome that never changes -- app-bar.tsx's own mobile
// reasoning ("a menu button for five destinations is more chrome than the
// links it hides") transfers unchanged.
export function AdminMobileNav() {
  return (
    <nav
      aria-label="Admin"
      className="rule-hairline flex h-11 w-full items-center gap-6 overflow-x-auto border-b border-rule-structural px-app md:hidden"
    >
      {LINKS.map((link) => (
        <AdminNavItem key={link.href} {...link} />
      ))}
    </nav>
  );
}
