import { useEffect, useState } from 'react';
import logo from '../assets/logo.svg';

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
  { id: 'capture', label: 'What it sees' },
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

  useEffect(() => {
    // One scroll listener drives both the bar treatment and the active link.
    // An IntersectionObserver would fire on entry/exit rather than on "which
    // section owns the reading position", and these sections are taller than
    // the viewport, so entry/exit is the wrong signal.
    const onScroll = () => {
      setScrolled(window.scrollY > 8);

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
  }, []);

  return (
    // Measured off linear.app: transparent background with backdrop-blur,
    // not a solid translucent fill. A literal hex background breaks visually
    // as content scrolls beneath it; on a translucent surface an alpha border
    // is the correct choice, and 0.8px is crisper than 1px at any DPI.
    <header
      className="fixed inset-x-0 top-0 z-50 h-[72px] transition-[background-color,border-color] duration-fast"
      style={{
        backgroundColor: scrolled ? 'rgba(8, 9, 10, 0.55)' : 'transparent',
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
        {/* 28px, up from 20px. At 20px in a 72px bar the mark read as an
            afterthought — the founder's word — because it occupied under a
            third of the bar's height while the CTA pill occupied half. */}
        <a href="/" className="flex shrink-0 items-center" aria-label="Ocular home">
          <img src={logo} alt="Ocular" className="h-9 w-auto" />
        </a>

        {/* Hidden below lg: four links plus a logo plus a CTA does not fit a
            phone bar, and a hamburger for a four-anchor page is more chrome
            than the links are worth. */}
        <nav aria-label="Sections" className="hidden lg:flex lg:items-center lg:gap-8">
          {LINKS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`relative font-mono text-[14px] tracking-[-0.01em] transition-colors duration-fast ease-base ${
                  isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {label}
                {/* The active mark is the accent rule, the same signifier the
                    demos use for "the instrument is reading this". */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 h-px w-full origin-left bg-accent transition-transform duration-fast ease-base"
                  style={{ transform: `scaleX(${isActive ? 1 : 0})` }}
                />
              </a>
            );
          })}
        </nav>

        <a
          href="/setup"
          className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-surface-base transition-[background-color,transform] duration-150 ease-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
        >
          Connect your agent
        </a>
      </div>
    </header>
  );
}
