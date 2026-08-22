// Brand Constants — Motion Design Bible §I.6. Fixed, non-motion brand
// values. Nothing outside this module may hardcode a colour, logo
// dimension, or type role; every consumer reads from here.

// §I.6 rule 1 — the two-color canon. Exact values measured from the master
// logo assets, not approximations.
export const INK = '#0B0F17';
export const WHITE = '#FFFFFF';

// §IV.15 rule 1 — the nine-step neutral scale, OKLCH-interpolated between
// Ink and White with slight chroma retention (so greys carry the brand's
// blue-ink cast rather than going neutral-dead). Values are the bible's own
// fixed hex table, not derived at runtime — they are canon, not a
// computation.
export const N = {
  '000': '#0B0F17', // Ocular Ink — L0/L1 field; type on light
  '100': '#151A24', // Raised surface on dark field
  '200': '#222836', // UI card fill (dark states)
  '300': '#39404F', // Borders, dividers (dark states)
  '400': '#5A6272', // Disabled / de-emphasised content
  '500': '#848B99', // Secondary text on dark; borders on light
  '600': '#AFB5C0', // Tertiary surfaces on light
  '700': '#D7DAE0', // UI card fill (light states)
  '800': '#EEF0F3', // Raised surface on light field
  '900': '#FFFFFF', // Ocular White — L3 field; type on dark
} as const;

export type NeutralToken = keyof typeof N;

// §I.6 rules 5-6 — Logomark/Catchlight construction ratios. The actual
// pixel-perfect icon geometry lives in tokens/logo-paths.ts (real vector
// art from the master asset) — SigilReveal renders that directly and
// doesn't need these. What's kept here is only what GazeRing still needs:
// it's a deliberately simplified "instrument" rendering of the Logomark
// (a thin stroked ring + small filled catchlight, not the real compound
// path — §IV.15 rule 8), so it needs ratios, not exact path data.
export const LOGOMARK = {
  ringOuterR: 150,
  ringInnerR: 90,
  ringThicknessRatio: (150 - 90) / (150 * 2), // ring thickness / outer diameter
  // §I.6 rule 5 / §IV.16 rule 5 — Catchlight center sits at 40deg from the
  // vertical axis, clockwise (upper-right), on the ring's inner edge.
  catchlightAngleDeg: 40,
} as const;

// §IV.15 rule 8 — Gaze Ring is the Logomark rendered as an instrument.
export const GAZE_RING = {
  defaultDiameterFrac: 0.055, // 5.5% of frame width
  strokeWeightRatio: LOGOMARK.ringThicknessRatio,
  catchlightAngleDeg: LOGOMARK.catchlightAngleDeg,
} as const;

// §II.12 rule 1 — type canon.
export const TYPE_ROLES = {
  display: { fontFamily: 'Poppins', fontWeight: 700 },
  support: { fontFamily: 'Poppins', fontWeight: 500 },
  ui: { fontFamily: 'Poppins', fontWeight: 400 },
} as const;

// §II.12 rule 4 — a Claim is at most eight words.
export const CLAIM_MAX_WORDS = 8;
export const CLAIM_MAX_LINES = 3;
