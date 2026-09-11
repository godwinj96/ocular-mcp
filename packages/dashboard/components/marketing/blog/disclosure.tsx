import type { ReactNode } from 'react';

// The bias-disclosure + product-definition + pre-launch-status block that
// opens every comparison post, per the product review this session ran
// before any post was drafted. Three separate elements would have been three
// separate credibility problems: a standalone "what is Ocular?" box reads as
// an ad unit, a standalone disclosure reads as a legal footnote, and neither
// alone tells a cold reader Ocular isn't installable yet. Combined, the
// disclosure buys the definition its right to appear in a post that is
// nominally about a competitor.
//
// Hairline rules (border-y border-rule-divider), never a card or a tinted
// panel -- a filled box around "here is why you should discount what I'm
// about to say" reads as staged. A plain rule reads as a note.
//
// Sits OUTSIDE .prose deliberately, with its own explicit type treatment
// rather than inheriting the cascade: it needs to render identically whether
// a future post puts it before or after other structural blocks, and prose.css
// is scoped to markdown-authored elements, not to page-level components like
// this one.
export function Disclosure({
  comparedAgainst,
  children,
}: {
  /** e.g. "chrome-devtools-mcp as of September 2026" */
  comparedAgainst: string;
  children: ReactNode;
}) {
  return (
    <div className="border-y border-rule-divider py-stack-3">
      <p className="font-mono text-[12px] leading-[1.5] tracking-[0.02em] text-text-tertiary">
        Compared against {comparedAgainst}.
      </p>
      <p className="mt-stack-2 text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
        {children}
      </p>
    </div>
  );
}
