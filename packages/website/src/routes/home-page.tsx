import { Hero } from '../components/hero.js';
import { BridgeStatement } from '../components/bridge-statement.js';
import { DemoTreeReadout } from '../components/demo-tree-readout.js';
import { DemoContactSheet } from '../components/demo-contact-sheet.js';
import { DemoReachMeter } from '../components/demo-reach-meter.js';
import { DemoBoundary } from '../components/demo-boundary.js';
import { HowItWorks } from '../components/how-it-works.js';
import { Pricing } from '../components/pricing.js';
import { Faq } from '../components/faq.js';
import { CtaFooter } from '../components/cta-footer.js';

// Round 5 order. Below the fold the page is demo-heavy rather than copy-heavy:
// every claim that can be shown is shown, and the copy is the caption layer.
//
// The sequence follows the objection order a sceptical developer actually
// has. The bridge statement is the hinge; then efficacy (what comes back, and
// why a screenshot alone isn't it), then motion, then reach, then the safety
// boundary — which sits after value and before price, because a developer who
// hasn't been sold yet doesn't care about the safety story and one who has
// cares a great deal.
//
// S1+S2 group as one chapter and S3+S4 as another, and the boundary spacing
// says so: a major gap opens a chapter, a minor gap separates the two
// sections inside one. Round 5 tried to express this by giving each section
// its own pad-top and pad-bottom, which produced seven different perceived
// gaps between 124px and 312px — the founder read that as sloppiness, not as
// rhythm. Each boundary now owns exactly one token (see tokens.css); every
// section below carries a padding-top only.
//
//   Hero      → Bridge    major
//   Bridge    → Tree      major   (chapter 1 opens)
//   Tree      → Contact   minor
//   Contact   → Reach     major   (chapter 2 opens)
//   Reach     → Boundary  minor
//   Boundary  → HowWorks major   (the close opens)
//   HowWorks  → Pricing   minor
//   Pricing   → FAQ       minor
//   FAQ       → Closer    major
//
// How-it-works opens the close chapter rather than sitting earlier, because
// "how much work is this to adopt" is not an objection a stranger has before
// they want the thing — it is the one immediately after wanting it and
// immediately before price. Putting it earlier would front-load chores ahead
// of desire and split the S1-S4 demo run the chapter spacing exists to hold
// together. It also gives the close a three-beat shape: it's easy to adopt,
// here's the price, here are the uncomfortable questions.
export function HomePage() {
  return (
    <>
      <Hero />
      <BridgeStatement />
      <DemoTreeReadout />
      <DemoContactSheet />
      <DemoReachMeter />
      <DemoBoundary />
      <HowItWorks />
      <Pricing />
      <Faq />
      <CtaFooter />
    </>
  );
}
