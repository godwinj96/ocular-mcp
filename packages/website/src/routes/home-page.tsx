import { Hero } from '../components/hero.js';
import { HowItWorks } from '../components/how-it-works.js';
import { WhyReliable } from '../components/why-reliable.js';
import { Pricing } from '../components/pricing.js';
import { Faq } from '../components/faq.js';
import { CtaFooter } from '../components/cta-footer.js';

export function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyReliable />
      <Pricing />
      <Faq />
      <CtaFooter />
    </>
  );
}
