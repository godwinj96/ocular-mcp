import type { ReactNode } from 'react';

// The below-fold header rank, shared by every section so the page reads as
// chapters rather than as a stack of unrelated blocks.
//
// Two things here were measured off linear.app at 1440x900 rather than
// chosen, and both are load-bearing:
//
//   1. The heading and deck are a TWO-COLUMN SPLIT sharing a top edge, not a
//      stack. Linear runs 668px + 668px. Stacking them, as this site did
//      through round 4, leaves the right half of a 1240px measure empty and
//      is where the "our whitespace is wrong" complaint actually came from —
//      it was never about padding.
//   2. H2 is 48px at line-height 1.0, not the 30px this site had. Linear is
//      48px, Vercel 56px. Against our (correct, already-matching) 64px H1
//      that puts the H2:H1 ratio at 0.75 where ours was 0.47 — a rank and a
//      half low, which is why the below-fold read as an appendix.
//
// Weight is 500, NOT 600. At 48px, Geist 600 out-shouts the hero's own 600
// emphasis span at 64px, because an H2 is a whole line where the hero's
// emphasis is half a sentence. Do not "fix" this to font-semibold.
interface SectionHeaderProps {
  eyebrow: string;
  heading: string;
  deck: ReactNode;
}

export function SectionHeader({ eyebrow, heading, deck }: SectionHeaderProps) {
  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[5fr_7fr] lg:gap-12">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary">
          {eyebrow}
        </p>
        <h2 className="mt-5 max-w-[12ch] text-[clamp(2rem,1.15rem+2.9vw,3rem)] font-medium leading-[1.0] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
          {heading}
        </h2>
      </div>
      {/* Flush to the H2's top edge on wide viewports — the shared baseline is
          the whole point of the split. */}
      <p className="max-w-deck text-[clamp(1.0625rem,0.88rem+0.68vw,1.375rem)] font-normal leading-[1.4] tracking-[-0.012em] text-text-secondary [text-wrap:pretty] lg:pt-[26px]">
        {deck}
      </p>
    </div>
  );
}

/** Full-bleed chapter rule. Four on the page, not one per section. */
export function BleedRule() {
  return (
    <hr
      aria-hidden="true"
      className="rule-hairline relative left-1/2 w-screen -translate-x-1/2 border-0 border-t border-rule-structural"
    />
  );
}
