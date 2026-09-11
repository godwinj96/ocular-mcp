import { Mark } from './mark.js';
import { BleedRule } from './section-header.js';
import { ConnectCta } from './connect-cta.js';

// S7 · The closer.
//
// The box is gone. The previous version stacked two linear-gradient()s to
// fake a gradient border — a direct violation of the no-gradient constraint
// that survived round 4 only because nobody looked at it — and centred the
// content, which made it the last element on the page still shaped like a
// template. Left-aligned to the same measure as everything else, with the
// page's largest air above it, does more than any container could.
//
// NOTE: "sign in once" describes the planned one-time browser sign-in, not
// today's paste-an-API-key setup. Do not ship to production before the
// AuthKit rework lands — see DEVLOG's tracked backlog item.
export function CtaFooter() {
  return (
    <>
      <BleedRule />
      <section
        className="pb-sec pt-sec"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <h2 className="max-w-[14ch] text-[clamp(2.25rem,1.2rem+3.6vw,3.5rem)] font-medium leading-[1.0] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
            Give your agent eyes.
          </h2>
          <p className="mt-7 max-w-[44ch] text-[clamp(1.0625rem,0.88rem+0.68vw,1.375rem)] leading-[1.4] tracking-[-0.012em] text-text-secondary [text-wrap:pretty]">
            One line in your MCP config, then sign in once. There&rsquo;s no API key to copy, and
            none to leak.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <ConnectCta />
            <p className="font-mono text-[11.5px] leading-none tracking-[0.02em] text-text-quaternary">
              from $2.50/mo · unmetered on localhost · cancel any time
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule-structural">
        <div
          className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 py-10 md:flex-row md:justify-between"
          style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
        >
          {/* P1 — the bare mark at 28px, not the 20px lockup.
              A footer is a sign-off: the bare mark is a signature, the lockup
              is letterhead, and the page said the name in the nav 8,000px ago.
              Direct precedent in four of ten surveyed sites (Linear 20x20 in
              currentColor, Railway 32x32, Warp 27x26, Sentry 36x32), and the
              deliberately-larger-at-the-bottom move in three more. 28px
              against the nav's 36px lockup is a size relationship rather than
              a repetition.

              opacity-80 is gone with the white fill it was dimming: the mark
              carries the brand silver as a colour now, not as faded white. */}
          <Mark className="h-7 text-accent" title="Ocular" />
          <p className="font-mono text-[11.5px] tracking-[0.02em] text-text-quaternary">
            © {new Date().getFullYear()} Ocular
          </p>
        </div>
      </footer>
    </>
  );
}
