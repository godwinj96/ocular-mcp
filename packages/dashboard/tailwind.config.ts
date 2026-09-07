import type { Config } from 'tailwindcss';
import { ocularPreset } from '@ocular/design-tokens/preset';

// The theme is the shared preset, not a hand-copied mirror of it. It used to
// be the latter, and it drifted: #0A0A0B / #131315 / #1C1C1F / #F2F2F0 /
// #8F8F94 against the site's #09090b / #121214 / #1a1a1d / #F4F4F2 / #A1A1A8.
// Near-misses, every one -- close enough that nobody spotted them, far enough
// that moving between the two surfaces in one session felt wrong without being
// nameable. The violet accent and the teal "glow" went the same way; see
// @ocular/design-tokens for what replaced them and why.
export default {
  presets: [ocularPreset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
} satisfies Config;
