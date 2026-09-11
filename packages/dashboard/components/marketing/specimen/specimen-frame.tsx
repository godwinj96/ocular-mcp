'use client';

import type { ReactNode } from 'react';
import { useFitScale } from '../../../hooks/marketing/use-fit-scale';

/** The notional width every specimen page is authored at. */
const DESIGN_WIDTH = 1440;

/**
 * Fits a specimen page into a demo frame.
 *
 * The specimen is laid out once at 1440px and scaled by the compositor, so
 * overlay-box coordinates stay derivable from real geometry instead of being
 * drawn by eye — which is the whole reason these are DOM and not screenshots.
 */
export function SpecimenFrame({ children }: { children: ReactNode }) {
  const { ref, scale } = useFitScale<HTMLDivElement>(DESIGN_WIDTH);

  return (
    <div ref={ref} className="specimen-frame absolute inset-0">
      {/*
        The explicit width is load-bearing and was missing. Without it the
        scaled div inherits the FRAME's width, so the specimen reflowed to
        whatever the frame happened to be and the scale factor was then
        applied on top of an already-fitted layout — the page was never
        actually laid out at 1440. In the hero (a wide frame) that rendered a
        zoomed, cropped fragment rather than a whole page, and it put every
        derived coordinate out by the same factor, which is how the tree
        readout came to report a 230px chart as 469px tall.

        With the width pinned, the specimen is authored at 1440 exactly as
        claimed, and `scale` maps it onto the frame — which is what makes
        "localhost:3000 · 1440 x 900" a true caption and the measured
        coordinates real page coordinates.
      */}
      <div className="specimen-scale" style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
