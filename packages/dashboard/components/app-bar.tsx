'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOutAction } from '../app/actions';
import { Wordmark } from './brand/wordmark';

// The dashboard's chrome. Before this existed, app/layout.tsx rendered
// <AuthKitProvider>{children}</AuthKitProvider> and literally nothing else, so
// every page hand-rolled the same `mx-auto max-w-3xl px-6 py-16` container and
// three of them hand-rolled their own "back" link. The authenticated root was
// a grid of link cards -- the founder's "3 cards floating in darkness" -- and
// those cards existed only because there was no navigation. With a bar, the
// root is free to answer questions instead of routing.
//
// A TOP BAR, NOT A SIDEBAR. Linear, Vercel, Notion and Stripe all run a fixed
// sidebar, and they are right to: dozens of destinations, real trees, many
// context switches per session. Ocular has four destinations and no tree. A
// 240px rail for four links spends a fifth of the column on chrome that never
// changes, and invents a hierarchy the product does not have.

const LINKS = [
  { href: '/', label: 'Status' },
  { href: '/usage', label: 'Usage' },
  { href: '/activity', label: 'Activity' },
  { href: '/billing', label: 'Billing' },
  { href: '/access', label: 'Access' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function AppBar({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' } as const] : LINKS;

  return (
    <header className="sticky top-0 z-50 bg-surface-base">
      <div className="rule-hairline border-b border-rule-structural">
        <div className="mx-auto flex h-bar w-full max-w-app items-center justify-between px-app">
          <Link
            href="/"
            className="text-accent transition-colors duration-fast ease-base hover:text-accent-hover"
          >
            <Wordmark className="h-7" title="Ocular" />
          </Link>

          <div className="flex items-center">
            <NavLinks links={links} pathname={pathname} />
            <div className="mx-4 hidden h-4 w-px bg-rule-mark md:block" />
            <AccountMenu email={email} />
          </div>
        </div>
      </div>

      {/* Under 768px the links drop to their own row rather than collapsing
          into a hamburger. Five mono links at 13px fit a phone width when they
          scroll; a menu button for five destinations is more chrome than the
          links it hides. */}
      <div className="rule-hairline border-b border-rule-structural md:hidden">
        <nav
          aria-label="Dashboard"
          className="mx-auto flex h-11 w-full max-w-app items-center gap-6 overflow-x-auto px-app"
        >
          {links.map((link) => (
            <BarLink key={link.href} {...link} active={isActive(pathname, link.href)} />
          ))}
        </nav>
      </div>
    </header>
  );
}

function NavLinks({
  links,
  pathname,
}: {
  links: readonly { href: string; label: string }[];
  pathname: string;
}) {
  return (
    <nav aria-label="Dashboard" className="hidden items-center gap-7 md:flex">
      {links.map((link) => (
        <BarLink key={link.href} {...link} active={isActive(pathname, link.href)} />
      ))}
    </nav>
  );
}

// The active mark is the website nav's, verbatim: a 1px accent rule that
// scales in from the left edge. Reusing it is the cheapest continuity the two
// surfaces can have -- the same gesture meaning the same thing in both places.
function BarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative shrink-0 font-mono text-[13px] tracking-[-0.01em] transition-colors duration-fast ease-base ${
        active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'
      }`}
    >
      {label}
      <span
        aria-hidden
        className={`absolute -bottom-[18px] left-0 h-px w-full origin-left bg-accent transition-transform duration-fast ease-base ${
          active ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
    </Link>
  );
}

function AccountMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const localPart = email?.split('@')[0] ?? 'Account';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="block max-w-[140px] truncate font-mono text-[12px] text-text-tertiary transition-colors duration-fast ease-base hover:text-text-primary"
      >
        {localPart}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] min-w-[220px] rounded border border-rule-mark bg-surface-elevated p-1"
        >
          <p className="truncate px-3 py-2 font-mono text-[11.5px] text-text-tertiary">{email}</p>
          <div className="my-1 h-px bg-rule-divider" />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex h-8 w-full items-center rounded px-3 text-left text-[13px] text-text-secondary transition-colors duration-fast ease-base hover:bg-surface-raised hover:text-text-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
