import { Hero } from '../components/hero.js';
import { BridgeStatement } from '../components/bridge-statement.js';
import { DemoTreeReadout } from '../components/demo-tree-readout.js';
import { DemoContactSheet } from '../components/demo-contact-sheet.js';
import { DemoReachMeter } from '../components/demo-reach-meter.js';
import { DemoBoundary } from '../components/demo-boundary.js';
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
// S1+S2 group as one chapter and S3+S4 as another; the four full-bleed rules
// fall between chapters rather than between every section. That asymmetry is
// deliberate — uniform padding is what makes a long page read as a stack of
// stripes rather than as a document.
export function HomePage() {
  return (
    <>
      <Hero />
      <BridgeStatement />
      <DemoTreeReadout />
      <DemoContactSheet />
      <DemoReachMeter />
      <DemoBoundary />
      <Pricing />
      <Faq />
      <CtaFooter />
    </>
  );
}
