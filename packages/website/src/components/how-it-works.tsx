import { BentoCell, BentoGrid } from './bento-grid.js';
import { ScrollReveal } from './scroll-reveal.js';

// One tile per real tool — names and behavior match packages/shared/src/schemas/
// exactly, per brand-identity.md §5's "no overclaiming" rule.
const TOOLS = [
  {
    name: 'view_page',
    description: 'Full-page or viewport screenshot of any URL, at low/balanced/high detail.',
  },
  {
    name: 'inspect_ui',
    description: 'Derived design tokens — palette, typography, spacing, breakpoints — no raw CSS.',
  },
  {
    name: 'extract_assets',
    description: 'Inline SVGs and image URLs, rewritten to absolute, safe-to-fetch links.',
  },
  {
    name: 'motion_capture',
    description: 'Verify animations and scroll effects as discrete stills — no video, no guessing.',
  },
  {
    name: 'get_quota',
    description: 'Remaining cloud renders and reset time — your dev-server captures are unmetered.',
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <h2 className="mb-10 text-display-md font-bold text-text-primary">How it works</h2>
      <BentoGrid>
        {TOOLS.map((tool, index) => (
          <ScrollReveal
            key={tool.name}
            index={index}
            className="col-span-2 md:col-span-2 lg:col-span-6"
          >
            <BentoCell span="half" as="article" className="h-full">
              <h3 className="font-mono text-lg font-semibold text-accent">{tool.name}</h3>
              <p className="mt-3 max-w-measure text-text-secondary">{tool.description}</p>
            </BentoCell>
          </ScrollReveal>
        ))}
      </BentoGrid>
      <p className="mt-8 max-w-measure text-text-secondary">
        One MCP connection, two execution paths. Localhost and your own dev server render on your
        machine, instantly, unmetered. The public web routes through Ocular's stealth-hardened cloud
        fleet. Your agent never has to know which one it's using.
      </p>
    </section>
  );
}
