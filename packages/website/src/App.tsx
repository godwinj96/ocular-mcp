import { Nav } from './components/nav.js';
import { Hero } from './components/hero.js';
import { HowItWorks } from './components/how-it-works.js';
import { WhyReliable } from './components/why-reliable.js';
import { Pricing } from './components/pricing.js';
import { Faq } from './components/faq.js';
import { CtaFooter } from './components/cta-footer.js';
import { DotField } from './components/dot-field.js';
import { ScrollProgress } from './components/scroll-progress.js';

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <DotField />
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <WhyReliable />
        <Pricing />
        <Faq />
      </main>
      <CtaFooter />
    </div>
  );
}
