'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from './wordmark';
import { useWaitlistMode } from '../../hooks/marketing/use-waitlist-mode';

// Round 4 stripped the nav to logo + CTA. That was defensible on a short
// page and wrong on this one: the founder's note was "there should be nav
// links so users don't have to scroll to reach every section like pricing,
// how it works etc." On a page this long the nav is the table of contents,
// not decoration.
//
// Five links, not ten. Every section does not deserve an entry — these are
// the four a visitor actually arrives looking for. The demo sections are
// discovered by scrolling; pricing and the FAQ are what someone jumps to.
const LINKS = [
  { id: 'capture', label: 'What comes back' },
  { id: 'motion', label: 'Motion' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const;

// Full-bleed bar, not a floating pill. The Round 2 pill carried
// `shadow-lg shadow-black/40` and `border-white/10` — a shadow, which the
// Instrument concept forbids outright, plus a translucent-white border, which
// is a glassmorphism tell. Both are exactly the generic-SaaS chrome the
// redesign is meant to remove.
//
// The bar's bottom hairline is the page's first structural rule, and it must
// run edge to edge: the tension between full-bleed rules and inset content is
// the architecture the whole layout depends on.
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  // Was useRouterState({ select: s => s.location.pathname === '/' }) under
  // TanStack Router. usePathname is the Next equivalent and the only thing
  // this component ever asked the router for.
  const onHome = usePathname() === '/';
  const waitlistMode = useWaitlistMode();

  useEffect(() => {
    // One scroll listener drives both the bar treatment and the active link.
    // An IntersectionObserver would fire on entry/exit rather than on "which
    // section owns the reading position", and these sections are taller than
    // the viewport, so entry/exit is the wrong signal.
    const onScroll = () => {
      setScrolled(window.scrollY > 8);

      // The section scan is home-page-only. Every id in LINKS is a section of
      // the homepage, so anywhere else this loop does five getElementById
      // lookups per scroll event for elements that cannot exist, and always
      // sets null. Already wasted work on /setup; a blog post is the longest
      // scrolling document on the site and would have made it the worst case.
      //
      // The listener itself is NOT skipped off the home page -- it also
      // drives `scrolled`, which is the bar's background and hairline
      // treatment, and that has to keep working on every route.
      if (!onHome) {
        setActive(null);
        return;
      }

      // The section that owns the line just below the fixed bar.
      const line = 96 + 1;
      let current: string | null = null;
      for (const { id } of LINKS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onHome]);

  return (
    // Measured off linear.app: transparent background with backdrop-blur,
    // not a solid translucent fill. A literal hex background breaks visually
    // as content scrolls beneath it; on a translucent surface an alpha border
    // is the correct choice, and 0.8px is crisper than 1px at any DPI.
    <header
      className="fixed inset-x-0 top-0 z-50 h-[72px] transition-[background-color,border-color] duration-fast"
      style={{
        // 0.90, not 0.55. The demos now render light-ground specimen pages,
        // and roughly 800px of the hero alone scrolls a near-white panel under
        // this bar — at 0.55 it composites to #717273, where the nav links sit
        // at 1.33:1 and the logotype at 4.38:1. Both were already failing
        // there; the violet pill was simply saturated enough to survive it and
        // a silver one is not. At 0.90 the links reach 4.51:1, the logotype
        // 14.82:1 and the pill 9.71:1, and the blur still shows a soft
        // gradient of the content behind, so the glass character survives.
        backgroundColor: scrolled ? 'rgba(8, 9, 10, 0.90)' : 'transparent',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.8px solid rgba(255, 255, 255, ${scrolled ? 0.12 : 0.08})`,
      }}
    >
      <div
        className="flex h-[72px] items-center justify-between gap-8"
        style={{
          paddingLeft: 'max(24px, calc((100vw - 1240px) / 2))',
          paddingRight: 'max(24px, calc((100vw - 1240px) / 2))',
        }}
      >
        {/* 36px, up from 20px. At 20px in a 72px bar the mark read as an
            afterthought — the founder's word — because it occupied under a
            third of the bar's height while the CTA pill occupied half.

            The asset had its background rect deleted first — it shipped
            carrying an opaque #0b0f17 plate, which drew a visible rectangle
            wherever the bar crossed a light section of the page — and is now
            inline SVG, so its fill is `currentColor` and the silver is a token
            on the link rather than a hex inside the file. */}
        <Link
          href="/"
          className="flex shrink-0 items-center text-accent transition-colors duration-fast hover:text-accent-hover"
          aria-label="Ocular home"
        >
          <Wordmark className="h-9" />
        </Link>

        {/* Hidden below lg: four links plus a logo plus a CTA does not fit a
            phone bar, and a hamburger for a four-anchor page is more chrome
            than the links are worth. */}
        <nav aria-label="Sections" className="hidden lg:flex lg:items-center lg:gap-8">
          {LINKS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                // Off the home page a bare `#id` resolves to nothing, so the
                // href carries the route. Under TanStack Router this also
                // needed an onClick calling navigate({ to: '/', hash: id }) to
                // keep it an SPA navigation; Next resolves `/#id` natively and
                // scrolls to the anchor on arrival, so the handler is gone
                // rather than reimplemented. Plain <a> and not next/link on
                // purpose: same-document hash jumps are the browser's job, and
                // Link would prefetch `/` from every one of these on hover.
                href={onHome ? `#${id}` : `/#${id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`relative font-mono text-[14px] tracking-[-0.01em] transition-colors duration-fast ease-base ${
                  isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {label}
                {/* The active mark is the primary, NOT the instrument signal.
                    This comment used to claim they were the same signifier;
                    they never were — the demos read in teal and this rule was
                    always the violet primary. The signal deliberately stays
                    out of the chrome: it means "the instrument is reading
                    this", and a nav link is not something being read. */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 h-px w-full origin-left bg-accent transition-transform duration-fast ease-base"
                  style={{ transform: `scaleX(${isActive ? 1 : 0})` }}
                />
              </a>
            );
          })}
        </nav>

        {waitlistMode ? (
          // Same onHome-aware anchor + intercept pattern as the section
          // links above — #pricing is where the site's one real signup
          // form lives (waitlist-cta.tsx), not a second form here.
          <a
            href={onHome ? '#pricing' : '/#pricing'}
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 font-brand text-[13px] font-semibold tracking-normal text-surface-base transition-[background-color,transform] duration-150 ease-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
          >
            Join the waitlist
          </a>
        ) : (
          <Link
            href="/setup"
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 font-brand text-[13px] font-semibold tracking-normal text-surface-base transition-[background-color,transform] duration-150 ease-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
          >
            Connect your agent
          </Link>
        )}
      </div>
    </header>
  );
}
