import { Hero } from '../../components/marketing/hero';
import { BridgeStatement } from '../../components/marketing/bridge-statement';
import { DemoTreeReadout } from '../../components/marketing/demo-tree-readout';
import { DemoContactSheet } from '../../components/marketing/demo-contact-sheet';
import { DemoReachMeter } from '../../components/marketing/demo-reach-meter';
import { DemoBoundary } from '../../components/marketing/demo-boundary';
import { UseCases } from '../../components/marketing/use-cases';
import { HowItWorks } from '../../components/marketing/how-it-works';
import { Pricing } from '../../components/marketing/pricing';
import { Faq } from '../../components/marketing/faq';
import { CtaFooter } from '../../components/marketing/cta-footer';

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
// sections inside one. Each boundary owns exactly one token (see tokens.css);
// every section below carries a padding-top only.
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
// immediately before price.
// Carried over from the Vite site's index.html, which had exactly one set of
// these for every route. Per-page now, which is the point of the move: a blog
// post that inherits the homepage's title and description is invisible in a
// result list.
const TITLE = 'Ocular — Real eyes for AI agents';
const DESCRIPTION =
  'Read-only visual perception for AI coding agents, over MCP. Your dev server and the open web, from one connection. From $2.50 a month.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: TITLE,
    description: DESCRIPTION,
    images: '/og-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: '/og-image.png',
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <BridgeStatement />
      <DemoTreeReadout />
      <DemoContactSheet />
      <DemoReachMeter />
      <DemoBoundary />
      <UseCases />
      <HowItWorks />
      <Pricing />
      <Faq />
      <CtaFooter />
    </>
  );
}
