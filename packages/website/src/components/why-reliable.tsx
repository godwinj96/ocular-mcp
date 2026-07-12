import { BentoCell, BentoGrid } from './bento-grid.js';
import { Parallax } from './parallax.js';
import { ScrollReveal } from './scroll-reveal.js';

// Copy directive (Round 2): assert the outcome with confidence, withhold the
// mechanism — wonder, not a teardown. No rung count, no escalation order, no
// classifier detail — that's the part we don't hand a competitor.
export function WhyReliable() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <BentoGrid>
        <ScrollReveal index={0} className="col-span-2 md:col-span-4 lg:col-span-8">
          <BentoCell span="hero" className="h-full">
            <h2 className="text-display-md font-bold text-text-primary">
              Most bots get caught in the first second.
            </h2>
            <p className="mt-4 max-w-measure text-text-secondary">
              Ocular doesn't. What happens between your request and a rendered page is the part
              we don't publish — every serious competitor would love to know.
            </p>
          </BentoCell>
        </ScrollReveal>
        <ScrollReveal index={1} className="col-span-2 md:col-span-2 lg:col-span-4">
          <BentoCell span="third" className="h-full">
            <Parallax range={12}>
              <p className="font-mono text-3xl font-bold text-accent">↑</p>
            </Parallax>
            <p className="mt-2 text-text-secondary">escalates only when it has to — never runaway, never wasted.</p>
          </BentoCell>
        </ScrollReveal>
      </BentoGrid>
    </section>
  );
}
