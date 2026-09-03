import logo from '../assets/logo.svg';
import { BleedRule } from './section-header.js';

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
        className="pb-sec-lg pt-sec-xl"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <h2 className="max-w-[14ch] text-[clamp(2.25rem,1.2rem+3.6vw,3.5rem)] font-medium leading-[1.0] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
            Give your agent eyes.
          </h2>
          <p className="mt-7 max-w-[44ch] text-[clamp(1.0625rem,0.88rem+0.68vw,1.375rem)] leading-[1.4] tracking-[-0.012em] text-text-secondary [text-wrap:pretty]">
            One line in your MCP config, then sign in once in the browser. There&rsquo;s no API key
            to copy, and none to leak.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <a
              href="/setup"
              className="inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] text-[13.5px] font-semibold tracking-[-0.005em] text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
            >
              Connect your agent
            </a>
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
          <img src={logo} alt="Ocular" className="h-5 w-auto opacity-80" />
          <p className="font-mono text-[11.5px] tracking-[0.02em] text-text-quaternary">
            © {new Date().getFullYear()} Ocular
          </p>
        </div>
      </footer>
    </>
  );
}
