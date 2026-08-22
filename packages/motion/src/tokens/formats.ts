// Format Canon — Motion Design Bible §I.6 rule 10. Kept for completeness so
// this package is genuinely reusable for the next Ocular video, even though
// the current consumer (an embedded hero panel) doesn't instantiate any of
// these directly — see the project's plan doc for why.

export type FormatToken = 'f-social-vertical' | 'f-social-square' | 'f-web-hero';

export type FormatDescriptor = {
  aspect: string;
  width: number;
  height: number;
  durationSecondsMin: number;
  durationSecondsMax: number;
  safeAreaInsets: { top: number; bottom: number; left: number; right: number };
};

// §I.6 rule 12 — safe-area-first for vertical: primary subjects/typography
// inside the central 80% vertically, avoiding platform UI occlusion zones
// (top ~12%, bottom ~15%).
export const FORMATS: Record<FormatToken, FormatDescriptor> = {
  'f-social-vertical': {
    aspect: '9:16',
    width: 1080,
    height: 1920,
    durationSecondsMin: 20,
    durationSecondsMax: 30,
    safeAreaInsets: { top: 0.12, bottom: 0.15, left: 0, right: 0 },
  },
  'f-social-square': {
    aspect: '1:1',
    width: 1080,
    height: 1080,
    durationSecondsMin: 20,
    durationSecondsMax: 30,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  'f-web-hero': {
    aspect: '16:9',
    width: 1920,
    height: 1080,
    durationSecondsMin: 60,
    durationSecondsMax: 90,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
} as const;
