import { CaptureReadout } from './capture-readout.js';

// Round 4. Built from the moodboard's "Instrument" concept plus live
// measurements taken off linear.app and vercel.com at 1440x900 — not from
// taste, and not from the moodboard thumbnail, which misled an earlier pass
// into treating a concept-card headline as a hero headline.
//
// What the measurements actually say:
//   - Linear's H1 is 64px at line-height 1.0, weight ~510, tracking -0.022em,
//     over a 15px subhead. That is a 4.3x headline:body ratio. Restraint does
//     not come from a small headline; it comes from tight leading, a weight
//     at or below 600, and a deliberately small subhead. Rounds 1-3 argued
//     about headline size and all three missed for that reason.
//   - The hero has ZERO entrance animation. No fade, no stagger, no
//     translate. The page simply renders, and only the signature moment
//     moves. A staggered five-element entrance is the exact tic the concept
//     rejects.
//   - The product panel is full-bleed and cropped by the fold at the BOTTOM.
//     That pulls the eye downward rather than sideways, and it survives every
//     breakpoint without a special case. The two-column hero split this file
//     used to have was itself part of the template problem.
//
// The stacked order is therefore: headline → split row → CTA → full-bleed
// panel running off the bottom of the viewport.

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-[136px]">
      <div style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}>
        <div className="mx-auto max-w-[1240px]">
          <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary [margin-left:-0.04em]">
            MCP server · Claude Code
          </p>

          {/* Weight-mixing inside one sentence is the concept's named
              hierarchy mechanism. Emphasis caps at 600 — 700 at this size is
              the marketing register the concept exists to avoid. */}
          <h1 className="mt-6 max-w-[17ch] text-[clamp(2.25rem,1.5rem+2.6vw,4rem)] font-normal leading-[1.0] tracking-[-0.022em] [text-wrap:balance]">
            {/* The non-breaking space goes BETWEEN "UI" and "it", binding them
                together so the only place the line can break is after
                "writes". It was previously placed before "UI", which bound
                "UI" to "writes" and forced the break on the wrong side —
                stranding a lit, semibold "UI" alone at the end of line 1. */}
            <span className="text-text-quaternary">Your agent writes</span>{' '}
            <span className="font-semibold text-text-primary">UI{' '}it can&rsquo;t see.</span>
          </h1>

          {/* One row, two ends, shared baseline — Linear aligns its hero link
              flush to the H1's right edge to within a pixel. Better use of the
              width than a stacked caption, and it puts price where it belongs:
              present, subordinate, not the first thing read. */}
          <div className="mt-10 flex flex-col gap-4 border-t border-rule-divider pt-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
            <p className="max-w-[52ch] text-[15px] font-normal leading-6 tracking-[-0.011em] text-[#8a8f98] [text-wrap:pretty]">
              So it guesses at layout, can&rsquo;t tell whether the canvas ever painted, and asks
              you whether it looks right. Ocular gives it sight — starting with your dev server.
            </p>
            <p className="shrink-0 font-mono text-[11.5px] leading-none tracking-[0.02em] text-text-quaternary">
              from $2.50/mo · unmetered on localhost
            </p>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <a
              href="/setup"
              className="inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] text-[13.5px] font-semibold tracking-[-0.005em] text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active"
            >
              Connect your agent
            </a>
            {/* NOTE: describes the planned one-time browser sign-in, not
                today's paste-an-API-key setup. Do not ship to production
                before that auth rework lands. */}
            <p className="font-mono text-[11.5px] leading-none tracking-[0.02em] text-text-quaternary">
              One line in your MCP config, then sign in once.
            </p>
          </div>
        </div>
      </div>

      {/* Full-bleed, cropped by the fold. No border, no shadow — the panel is
          the page's one lit object and it needs no frame to say so. */}
      <div id="readout" className="mt-20 px-0">
        <div className="mx-auto max-w-[1680px] px-[var(--page-inset)]">
          <CaptureReadout />
        </div>
      </div>
    </section>
  );
}
