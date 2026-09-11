'use client';

import { SectionHeader } from './section-header';
import { useInView } from '../../hooks/marketing/use-in-view';
import contactSheet from '../../assets/motion-contact-sheet-1x5.webp';

// S2 · Your agent sees it move.
//
// THIS IMAGE IS REAL TOOL OUTPUT. It is not a drawing of a contact sheet: it
// is the exact WebP `motion_capture` returned, captured by the local worker
// against public/specimens/fieldnote.html on localhost, tile labels and all.
// Regenerate with `npx tsx scripts/capture-motion-specimen.mjs` whenever that
// specimen changes, or the demo and the page it claims to depict diverge.
//
// The previous version of this section was eight hand-built DOM cells
// animating a drawer, and it failed for two reasons the founder identified:
//
//   1. THE AXES COLLIDED. The tracked motion ran right-to-left while the
//      frames were also sequenced left-to-right, so the eye could not
//      separate the animation from the grid. The specimen now animates
//      VERTICALLY against a horizontally-sequenced sheet.
//   2. HALF OF IT WASN'T RENDERING. The cells' static content bars used
//      `bg-text-inactive` and `bg-rule-mark`, neither of which existed in the
//      dev server's stale Tailwind build — so the fixed datum that made the
//      moving element measurable was invisible during review. See tokens.css.
//
// Showing the real artefact also removes a standing honesty problem: a
// hand-drawn approximation of the output is a claim about the product that
// nothing verifies. This one is checkable — the labels in the image are the
// extractor's own, and the scroll offsets in them are real.
//
// The stagger loop is deliberately gone. Lighting ten cells one at a time
// added a SECOND temporal axis on top of the frames' own, which is what made
// the old demo feel sequenced while the frames themselves weren't doing that
// work — and it made a finished artefact read as a skeleton still loading,
// contradicting the caption directly beneath it. One fade of the whole plate.

// Five tiles in a single row, the founder's call: "lets make it 5x1 for
// simplicity's sake." A 5x2 sheet asks the eye to wrap, and wrapping a
// sequence re-introduces exactly the second reading axis the note below says
// this section removed.
//
// The image is a capture at `samples: 5`, a real argument to the real tool --
// NOT the extractor's default lowered to suit this page. Halving
// SCROLL_SCRUBBED_SAMPLES would have made every caller's scroll capture
// lossier to fix a website layout; the schema carries a per-call knob instead.
// Regenerate with `npx tsx scripts/capture-motion-specimen.mjs`.
const TILE_COUNT = 5;

export function DemoContactSheet() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="motion"
      className="pb-sec-tail pt-sec"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          eyebrow="Motion"
          heading="Your agent sees it move"
          deck="Animations, transitions, anything that moves when you scroll — they all come back as a strip of still pictures in one image. Your agent can see the whole sequence without needing video."
        />
      </div>

      <div ref={ref} className="mx-auto mt-group max-w-demo">
        <div
          className="overflow-hidden rounded transition-opacity duration-500 ease-base"
          style={{ opacity: inView ? 1 : 0 }}
        >
          {/* `.src`, not the import itself: Vite hands back a URL string for
              an image import, webpack hands back a StaticImageData object.
              Rendering the object straight into src is the silent version of
              this difference -- no build error, just a broken image. Plain
              <img> rather than next/image on purpose, so the explicit
              dimensions and lazy/async hints below stay exactly as tuned. */}
          <img
            src={contactSheet.src}
            // The alt text carries the claim for anyone who can't see the
            // image, which is exactly the population the product exists to
            // serve on the other side of the wire.
            alt={`Contact sheet of ${TILE_COUNT} frames captured by Ocular from a scrolling page. A blue issue card climbs from the bottom of the frame to the top across the sequence; each tile is labelled with its capture time and scroll offset.`}
            width={1200}
            height={180}
            loading="lazy"
            decoding="async"
            className="block w-full"
          />
        </div>
        <p className="mt-stack-2 font-mono text-[11px] leading-none tracking-[0.02em] text-text-quaternary">
          {TILE_COUNT} frames · one image · one request · captured by Ocular
        </p>
      </div>
    </section>
  );
}
