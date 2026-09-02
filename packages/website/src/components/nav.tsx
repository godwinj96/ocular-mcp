import logo from '../assets/logo.svg';
import { MotionCta } from './motion-cta.js';

// Floating rounded pill (Raycast reference pattern, Round 2) — replaces the
// Round 1 full-width sticky bar, per brand-identity.md §6 component notes.
export function Nav() {
  return (
    <header className="sticky top-4 z-50 mx-auto max-w-3xl px-4">
      <div
        className="flex items-center justify-between rounded-full border border-white/10 bg-surface-elevated/80 px-5 py-3 shadow-lg shadow-black/40 backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface-elevated) 80%, transparent)' }}
      >
        <a href="/" className="flex items-center" aria-label="Ocular home">
          <img src={logo} alt="Ocular" className="h-5 w-auto" />
        </a>
        <MotionCta
          href="/setup"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-surface-base transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Connect Ocular
        </MotionCta>
      </div>
    </header>
  );
}
