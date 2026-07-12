import logo from '../assets/logo.svg';
import { MotionCta } from './motion-cta.js';
import { Parallax } from './parallax.js';
import { ScrollReveal } from './scroll-reveal.js';

// One action per viewport (Stripe teardown rule, brand-identity.md §5.7).
export function CtaFooter() {
  return (
    <>
      <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
        <ScrollReveal>
          <Parallax range={16}>
            <div
              className="rounded-2xl p-10 text-center md:p-16"
              style={{
                backgroundImage:
                  'linear-gradient(var(--surface-elevated), var(--surface-elevated)), linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 40%, rgba(124,108,255,0.18))',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                border: '1px solid transparent',
              }}
            >
              <h2 className="text-display-md font-bold text-text-primary">Give your agent eyes.</h2>
              <p className="mx-auto mt-4 max-w-measure text-text-secondary">
                One connection. $1/mo. Your agent sees the web the way you do.
              </p>
              <MotionCta
                href="#pricing"
                className="mt-8 inline-block rounded-full bg-accent px-8 py-3 font-semibold text-surface-base transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Connect Ocular
              </MotionCta>
            </div>
          </Parallax>
        </ScrollReveal>
      </section>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-4 px-6 py-10 md:flex-row md:justify-between">
          <img src={logo} alt="Ocular" className="h-5 w-auto opacity-80" />
          <p className="font-mono text-xs text-text-secondary">
            © {new Date().getFullYear()} Ocular
          </p>
        </div>
      </footer>
    </>
  );
}
