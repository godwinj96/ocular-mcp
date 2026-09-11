'use client';

import { usePathname } from 'next/navigation';

import { useWaitlistMode } from '../../hooks/marketing/use-waitlist-mode';

// The primary "Connect your agent" CTA, shared by hero.tsx and
// cta-footer.tsx (byte-identical styling in both — the two places on the
// page roomy enough for the full-size pill, unlike nav.tsx's compact bar
// version, which keeps its own copy for that reason).
//
// When waitlist mode is on, this does NOT duplicate a signup form here —
// it points at #pricing, the one place on the page that actually has one
// (waitlist-cta.tsx). Every CTA on the site converging on one real form
// avoids three-to-four independently wired submission paths for what's
// fundamentally one action.
//
// The onHome check is the same one nav.tsx already documents at its own
// section links: off the home page a bare `#pricing` resolves to nothing, so
// the click silently does nothing at all. This component missed it because
// its only two consumers -- hero.tsx and cta-footer.tsx -- are both
// homepage-only, so the bug had nowhere to show. A blog route is the first
// place it would have.
export function ConnectCta() {
  const onHome = usePathname() === '/';
  const waitlistMode = useWaitlistMode();

  return (
    <a
      href={waitlistMode ? (onHome ? '#pricing' : '/#pricing') : '/setup'}
      className="inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] font-brand text-[13.5px] font-semibold tracking-normal text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
    >
      {waitlistMode ? 'Join the waitlist' : 'Connect your agent'}
    </a>
  );
}
