'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminNavItemProps {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

// Same typographic voice as app-bar.tsx's BarLink -- mono, 13px -- reused
// deliberately: top bar to rail is the cheapest continuity available. The
// active mark is that same scaling-rule idea rotated for a vertical list: a
// 1px accent edge that scales in, here from the left rather than the
// bottom.
export function AdminNavItem({ href, label }: AdminNavItemProps) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-9 items-center pl-4 font-mono text-[13px] tracking-[-0.01em] transition-colors duration-fast ease-base ${
        active
          ? 'text-text-primary'
          : 'text-text-tertiary hover:bg-surface-elevated hover:text-text-primary'
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-accent transition-transform duration-fast ease-base ${
          active ? 'scale-y-100' : ''
        }`}
      />
      {label}
    </Link>
  );
}
