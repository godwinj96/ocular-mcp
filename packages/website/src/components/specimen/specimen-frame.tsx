import type { ReactNode } from 'react';
import { useFitScale } from '../../hooks/use-fit-scale.js';

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
      <div className="specimen-scale" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
