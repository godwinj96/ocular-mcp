import { BleedRule } from './section-header.js';

// S0. The hinge between the hero and the demos, and the only section on the
// page with no demo at all.
//
// It sits directly under the hero's cropped readout panel so that panel butts
// into this line the way linear.app's product window butts into its own hero.
// The device is the hero's weight-mix — dim clause, lit clause — used exactly
// once more so it reads as the page's rhetorical signature rather than as a
// tic. Everything else here is air, and the air is the point: this is the
// sentence that has to make a stranger understand the product, so nothing
// competes with it.
export function BridgeStatement() {
  return (
    <>
      <BleedRule />
      <section
        className="py-sec-lg"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <p className="max-w-[26ch] text-[clamp(1.75rem,1rem+2.9vw,3rem)] leading-[1.08] tracking-[-0.022em] [text-wrap:balance]">
            <span className="font-medium text-text-quaternary">
              Your agent has read every line of the code.
            </span>{' '}
            <span className="font-semibold text-text-primary">It has never seen the page.</span>
          </p>
        </div>
      </section>
    </>
  );
}
