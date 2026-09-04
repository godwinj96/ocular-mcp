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
    <div className="grid grid-cols-1 gap-stack-3 lg:grid-cols-[5fr_7fr] lg:gap-12">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary">
          {eyebrow}
        </p>
        <h2 className="mt-stack-2 max-w-[12ch] text-[clamp(2rem,1.15rem+2.9vw,3rem)] font-medium leading-[1.0] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
          {heading}
        </h2>
      </div>
      {/* Flush to the H2's top edge on wide viewports — the shared baseline is
          the whole point of the split. */}
      {/* The deck is in the brand face (Outfit), the founder's call. The design
          agent staged this one: SectionHeader is a two-column split where a 48px
          Geist H2 and a ~22px Outfit deck share an exact optical top edge with
          cap-heights within 1.4% of each other, and two near-identical sans
          faces in direct adjacency read as a font-loading bug rather than as a
          pairing. Both halves of its mitigation are applied: the H2 renders at
          500 for the first time (geist-sans 500 is finally loaded — see
          main.tsx), so the deck at 400 is clearly subordinate rather than
          equal; and the top padding goes 26px -> 30px so the two faces no
          longer share an exact optical top edge. Close pairings work when one
          is plainly subordinate; they fail when adjacent and equal.

          Size steps 17->18px min / 22->23px max: Outfit's x-height is 0.906 of
          Geist's, so apparent size in running text needs a ~x1.07 correction.
          Tracking eases -0.012em -> -0.006em because the old value was tuned to
          Geist's wider fit and over-tightens Outfit's rounder counters. */}
      <p className="max-w-deck font-brand text-[clamp(1.125rem,0.93rem+0.72vw,1.4375rem)] font-normal leading-[1.45] tracking-[-0.006em] text-text-secondary [text-wrap:pretty] lg:pt-[30px]">
        {deck}
      </p>
    </div>
  );
}

/**
 * Full-bleed chapter rule. Four on the page, not one per section.
 *
 * These now carry the chapter distinction on their own. Round 6 expressed it
 * with two gap sizes; that could not survive the eyebrow problem (see
 * tokens.css), so the air is uniform and the rule is the mark. A hairline is
 * a stronger chapter signal than 30px of extra space ever was, and it costs
 * no page height.
 *
 * mt-6 is load-bearing, not decoration: with the boundary gap living entirely
 * on the NEXT section's padding-top, three of these four rules were rendering
 * flush against the previous section's last line — the rule read as
 * underlining the section above rather than opening the one below. The
 * section tail plus this margin puts it 72px under the previous content and a
 * full gap above the next.
 */
export function BleedRule() {
  return (
    <hr
      aria-hidden="true"
      className="rule-hairline relative left-1/2 mt-6 w-screen -translate-x-1/2 border-0 border-t border-rule-structural"
    />
  );
}
