// Material Specification — Motion Design Bible §IV.15. What things are made
// of, as opposed to how they behave.

// §IV.15 rule 7 — corner radius scale, at 1080-width reference, scaled
// proportionally by format. Logomark/Gaze Ring are perfect circles, exempt.
export const RADIUS_PX = { sm: 8, md: 16, lg: 24 } as const;

// §IV.15 rule 6 — canonical shadow at L2. Absent at L0 (flat space), full at
// L2-L3. Expressed as fractions of subject height so it scales with the
// composition.
export const SHADOW_L2 = {
  yOffsetFrac: 0.04,
  blurFrac: 0.08,
  opacity: 0.18,
} as const;

// §IV.15 rule 9 — typography rendering, at 1080-width reference.
export const TYPE_SIZE_PX = { display: [72, 96], support: [40, 48], ui: [24, 32] } as const;
export const TYPE_LINE_HEIGHT = { display: 1.15, other: 1.35 } as const;
export const TYPE_TRACKING = { display: -0.015, other: 0 } as const;

// --- Focus Field System (§II.9) — [Draft] chapter, no canonical parameters
// exist yet (Appendix D, Open Question 1: "canonical blur-radius scale and
// rack-focus timing need definition"). The values below are a placeholder,
// not canon: they follow the same doubling progression as the Temporal
// Grammar duration scale purely for internal consistency, so Resolution
// reveals and the Sigil Reveal's Catchlight-from-defocus have *something*
// principled to render with. Treat FOCUS_BLUR_PX as provisional and revisit
// once §II.9 is promoted out of Draft via a real DDR — do not treat this as
// settled canon.
export const FOCUS_BLUR_PX = {
  sharp: 0,
  soft: 4,
  softer: 8,
  softest: 16,
} as const;
