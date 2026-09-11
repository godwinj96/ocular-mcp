'use client';

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
export function ConnectCta() {
  const waitlistMode = useWaitlistMode();

  return (
    <a
      href={waitlistMode ? '#pricing' : '/setup'}
      className="inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] font-brand text-[13.5px] font-semibold tracking-normal text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
    >
      {waitlistMode ? 'Join the waitlist' : 'Connect your agent'}
    </a>
  );
}
