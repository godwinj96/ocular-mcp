import { useEffect, useRef, useState } from 'react';
import { NorthsoundCheckout } from './specimen/northsound-checkout.js';
import { SpecimenFrame } from './specimen/specimen-frame.js';
import { usePrefersReducedMotion } from '../hooks/use-reduced-motion.js';
import { ReadoutOverlay, useReadoutCycle } from './readout-overlay.js';
import { Mark } from './mark.js';

// The page's one signature moment.
//
// ROUND 5 — the founder's note on round 4 was exact: "the window with the a11y
// boxes and the skeleton aren't an animation, they're just a transition. The
// period of motion is too brief; it should be constantly playing to give that
// impression of life." Round 4 was useState plus CSS transitions fired once on
// mount, and its entire motion budget was spent in 2.1 seconds. It then sat
// dead for the rest of the visit, which is exactly why it read as a card with
// a skeleton in it.
//
// So this runs a perpetual cycle: SWEEP -> ACQUIRE -> READ -> RELEASE -> REST,
// forever, 7400ms per pass. That cycle, the boxes and the labels now live in
// readout-overlay.tsx, because the tree-readout demo needs the same instrument
// and a copy of it would have drifted from this one on the first tuning pass.
// What stays here is what is genuinely the HERO's: the one-time resolve, the
// vignette that lands with it, the chrome bar, and the registration marks.
//
// The correction that matters most: the blur/desaturate resolve does NOT loop.
// Re-blurring every cycle would read as a strobing toy, and it would also be
// dishonest — Ocular does not gradually focus. The resolve stays a one-time
// arrival on mount; the perpetual cycle then runs on the already-resolved
// frame. What repeats is the part that genuinely repeats in the product: it
// scans, it acquires, it reads, it lets go, it waits.

const RESOLVE_START_MS = 520;
const RESOLVE_MS = 900;

export function CaptureReadout() {
  const reduceMotion = usePrefersReducedMotion();
  const [resolved, setResolved] = useState(false);
  const resolveLayer = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  /** Drives the chrome-bar word and the overlay's read highlight. */
  const { t, phase } = useReadoutCycle(reduceMotion);

  // One-time resolve on mount.
  useEffect(() => {
    if (reduceMotion) {
      setResolved(true);
      return;
    }
    const id = setTimeout(() => setResolved(true), RESOLVE_START_MS);
    return () => clearTimeout(id);
  }, [reduceMotion]);

  // will-change is set for the resolve only and dropped afterwards — a
  // permanently promoted layer costs memory for the life of the page.
  useEffect(() => {
    const el = resolveLayer.current;
    if (!el || !resolved || reduceMotion) return;
    el.style.willChange = 'filter, opacity';
    const done = setTimeout(() => {
      el.style.willChange = '';
    }, RESOLVE_MS + 60);
    return () => clearTimeout(done);
  }, [resolved, reduceMotion]);

  return (
    <div className="relative">
      {/* Registration marks — alignment ticks on the chassis, offset 6px
          outside the frame so they read as targeting the panel rather than
          decorating it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-[6px] -top-[6px] h-2 w-2 border-l border-t border-rule-mark"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[6px] -top-[6px] h-2 w-2 border-r border-t border-rule-mark"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[6px] -left-[6px] h-2 w-2 border-b border-l border-rule-mark"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[6px] -right-[6px] h-2 w-2 border-b border-r border-rule-mark"
      />

      <div className="relative overflow-hidden rounded border border-rule-mark bg-surface-elevated">
        {/* Chrome bar. The macOS traffic-light dots are deliberately gone —
            they are the most template-coded element available. Mono telemetry
            separated by hairlines reads as an instrument instead, and the
            right-hand word is the loop's own status. */}
        <div className="flex items-center gap-3 border-b border-rule-divider px-4 py-3">
          <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
            localhost:3000
          </span>
          <span className="h-3 w-px bg-rule-structural" />
          <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
            1440 × 900
          </span>
          <span className="ml-auto flex items-center gap-2">
            {/* P2 — the status indicator IS the mark.
                The mark is an eye; this indicator means "this is being looked
                at." Those are the same idea, and the slot was being spent on a
                generic 1px dot. It replaces an element rather than adding one,
                so it costs no new visual vocabulary and no page height.

                Teal, not silver, and that is the point: --signal owns
                "the instrument is reading this" while --accent owns the
                instrument's own identity. The same glyph being silver in the
                nav and teal here is the colour system doing visible work, not
                an inconsistency.

                11px is a floor, not a preference — below about 10px the iris
                closes up and the glyph reads as a blob. It also optically
                matches the 11px mono label beside it. */}
            <Mark
              className="h-[11px] transition-colors duration-fast"
              style={{ color: phase === 'idle' ? 'var(--text-inactive)' : 'var(--signal)' }}
            />
            <span className="font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
              {phase}
            </span>
          </span>
        </div>

        <div ref={frameRef} className="relative aspect-[16/10]">
          <div
            ref={resolveLayer}
            className="absolute inset-0 transition-[filter,opacity] ease-base"
            style={{
              filter: resolved ? 'blur(0px) saturate(1)' : 'blur(12px) saturate(0.2)',
              opacity: resolved ? 1 : 0.55,
              transitionDuration: `${RESOLVE_MS}ms`,
            }}
          >
            <SpecimenFrame>
              <NorthsoundCheckout />
            </SpecimenFrame>
          </div>

          {/* Vignette arrives WITH the resolve. A static vignette is texture;
              one that lands on the resolve is an optical event.
              Pulled back from 0.74 to 0.42 and its clear centre widened once
              the frame held a LIGHT specimen: values tuned against a dark
              mock read as fog over a white page, and a page that looks fogged
              stops reading as a real page, which is the entire point of it. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity ease-base"
            style={{
              background:
                'radial-gradient(125% 95% at 50% 0%, transparent 52%, rgba(9,9,11,0.42) 100%)',
              opacity: resolved ? 1 : 0,
              transitionDuration: `${RESOLVE_MS}ms`,
            }}
          />

          {/* The sweep waits for the resolve — a scan line crossing a blurred
              frame would claim a reading of something not yet legible. The
              boxes do not wait, which is the existing behaviour: they are
              already mid-cascade as the frame arrives. */}
          <ReadoutOverlay
            frameRef={frameRef}
            t={t}
            reduceMotion={reduceMotion}
            showSweep={resolved}
          />
        </div>
      </div>
    </div>
  );
}
