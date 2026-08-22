import { useCurrentFrame } from 'remotion';
import { T, tokenInterpolate } from '../tokens/temporal.js';
import { INK, WHITE } from '../tokens/brand.js';
import {
  LOGO_GROUP_TRANSFORM,
  LOGO_ICON_PATH,
  LOGO_LETTERS,
  LOGO_VIEWBOX,
} from '../tokens/logo-paths.js';
import { useRackFocusBlur } from '../systems/FocusField.js';

// Sigil Reveal — Motion Design Bible §I.6 rules 7-9, DDR-018. The canonical
// logo entrance, rendered from the real production vector art (see
// tokens/logo-paths.ts — copied verbatim from the master logo.svg asset,
// not reconstructed from geometric primitives). The icon is a single
// boolean-merged compound path; since the ring must never rotate or
// animate (rule 8), there is no need to keep it separable into a ring +
// accent-circle construction the way an earlier, approximated version did.
//
// Sequence (rule 7, contrast-relative so it executes identically at either
// polarity pole):
//   (a) present at <=8% luminance contrast against the field;
//   (b) the icon resolves from defocus over t-base using e-shift — applied
//       to the whole compound icon shape now that the Catchlight isn't a
//       separable element;
//   (c) contrast rises from <=8% to full;
//   (d) the wordmark enters as a single reveal (one motion, never
//       per-letter) over t-deliberate using e-reveal — all five letters
//       share one opacity ramp, never animated independently.

export type SigilRevealProps = {
  atFrame: number;
  polarity: 'dark' | 'light';
  /** Height in px of the whole lockup (icon + wordmark); width follows the source asset's aspect ratio. */
  sizePx?: number;
};

const LOW_CONTRAST_OPACITY = 0.08;
export const SIGIL_REVEAL_TOTAL_FRAMES = T.base + T.deliberate + T.deliberate;

const ASPECT = LOGO_VIEWBOX.width / LOGO_VIEWBOX.height;

export function SigilReveal({ atFrame, polarity, sizePx = 64 }: SigilRevealProps) {
  const frame = useCurrentFrame();
  const markColor = polarity === 'dark' ? WHITE : INK;

  // (a)+(c) contrast ramp: <=8% -> full, over t-scenic.
  const contrastOpacity = tokenInterpolate(
    frame,
    atFrame,
    'scenic',
    LOW_CONTRAST_OPACITY,
    1,
    'shift',
  );

  // (b) icon resolves from defocus over t-base using e-shift.
  const iconBlur = useRackFocusBlurSafely(atFrame);

  // (d) wordmark enters as a single reveal, once the icon has established.
  const wordmarkStart = atFrame + T.base;
  const wordmarkOpacity = tokenInterpolate(frame, wordmarkStart, 'deliberate', 0, 1, 'reveal');

  const height = sizePx;
  const width = sizePx * ASPECT;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      style={{ opacity: contrastOpacity, display: 'block' }}
    >
      <g transform={LOGO_GROUP_TRANSFORM} fill={markColor}>
        <g style={{ filter: `blur(${iconBlur}px)` }}>
          <path d={LOGO_ICON_PATH} />
        </g>
        <g opacity={wordmarkOpacity}>
          {LOGO_LETTERS.map((letter) => (
            <path key={letter.id} d={letter.d} transform={`translate(${letter.translateX},0)`} />
          ))}
        </g>
      </g>
    </svg>
  );
}

// useRackFocusBlur asserts an AwarenessTimeline ancestor and throws below
// L0 — reasonable everywhere else in this package, but SigilReveal is used
// at both narrative bookends (including the Conviction rest frame, which
// may render before any AwarenessTimeline event has advanced past initial
// state). Rather than force every consumer to guarantee L1+ context just to
// render a static icon, degrade to "no blur" if the hook throws.
function useRackFocusBlurSafely(atFrame: number): number {
  try {
    return useRackFocusBlur(atFrame, 'base', 'toSharp', 'soft');
  } catch {
    return 0;
  }
}
