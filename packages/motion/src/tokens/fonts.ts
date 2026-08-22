import { loadFont } from '@remotion/google-fonts/Poppins';

// §II.12 rule 1 / DDR-011 — Poppins Bold (700) / Medium (500) / Regular
// (400), the canonical typeface. Call once at the consuming composition's
// module scope (Remotion's own convention for @remotion/google-fonts) —
// not inside a component body.
export function loadPoppins() {
  return loadFont('normal', { weights: ['400', '500', '700'] });
}
