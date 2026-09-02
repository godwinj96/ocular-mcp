import { useEffect, useState } from 'react';
import logo from '../assets/logo.svg';

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
        className="flex h-[72px] items-center justify-between"
        style={{
          paddingLeft: 'max(24px, calc((100vw - 1240px) / 2))',
          paddingRight: 'max(24px, calc((100vw - 1240px) / 2))',
        }}
      >
        <a href="/" className="flex items-center" aria-label="Ocular home">
          <img src={logo} alt="Ocular" className="h-5 w-auto" />
        </a>
        <a
          href="/setup"
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-surface-base transition-[background-color,transform] duration-150 ease-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
        >
          Connect your agent
        </a>
      </div>
    </header>
  );
}
