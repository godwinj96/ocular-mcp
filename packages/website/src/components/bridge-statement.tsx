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
//
// ROUND 8 — the previous sentence ("Your agent has read every line of the
// code. It has never seen the page.") is gone, and the reason is worth
// keeping. It asserted a capability gap the target reader has ALREADY closed:
// per docs/Ocular_PRD_v0.2.md line 15 the validated demand signal is precisely
// the population running "screenshot MCP wrappers, cron diff monitors, manual
// screenshot-paste". A reader with a working script reads that line, thinks
// "mine has," and concludes the page is about someone else.
//
// The founder's own three reasons to pay, and this sentence carries exactly
// those and nothing else: it is SIMPLER TO SET UP, it has LOWER LATENCY, and
// it works beyond localhost.
//
// One deliberate departure from his wording. He said "works for the whole
// web"; CLAUDE.md's base-tier honesty guardrail forbids implying every site is
// reachable, because rungs 0-1 clear most protected sites and not all. "Your
// dev server and the open web" claims the reach without claiming totality.
//
// The latency claim is about what the reader gets — no wait — never about how
// it is achieved. CLAUDE.md bars positioning on technique outright, and a warm
// browser is not an invention; it is table stakes we actually bothered to do.
// Naming the mechanism would break the rule and weaken the line.
export function BridgeStatement() {
  return (
    <>
      <BleedRule />
      <section
        className="pb-sec-tail pt-sec"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <p className="max-w-[28ch] text-[clamp(1.75rem,1rem+2.9vw,3rem)] leading-[1.08] tracking-[-0.022em] [text-wrap:balance]">
            <span className="block font-medium text-text-quaternary">
              One line to set up. Nothing to wait for.
            </span>
            <span className="block font-semibold text-text-primary">
              Your dev server and the open web, from the same connection.
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
