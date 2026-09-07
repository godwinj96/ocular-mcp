import type { Config } from 'tailwindcss';
import { ocularPreset } from '@ocular/design-tokens/preset';

// The theme now lives in @ocular/design-tokens, shared with the dashboard --
// see that package for why. This file is content globs and nothing else.
//
// `display-lg` (clamp(3rem, 2rem + 5vw, 7rem)) remains deliberately absent
// rather than merely unused: it existed only to tempt a future pass back into
// the 7rem-headline register the Instrument concept rejects. The H1 scale
// lives inline in hero.tsx, bounded by the H1:body ratio the concept actually
// protects (~2.6-3.1x), not by a free-floating display step. Note that ratio
// is a HERO rule and does not transfer to the dashboard, which runs 2.0x.
export default {
  presets: [ocularPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
