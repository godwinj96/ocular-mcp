// Shared motion values for all NEW motion code (dot-field, workflow-demo,
// Phase 7 sitewide pass). Existing hero.tsx/scroll-reveal.tsx inline values
// are intentionally left as-is — this file exists so nothing written from
// here on scatters more inline magic numbers, not to retrofit prior files.
export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
    slow: 0.6,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as const,
    sharp: [0.4, 0, 0.2, 1] as const,
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  },
  scale: {
    press: 0.96,
    pop: 1.03,
  },
};

export const springs = {
  snappy: { type: 'spring', stiffness: 300, damping: 30 } as const,
  gentle: { type: 'spring', stiffness: 120, damping: 14 } as const,
};
