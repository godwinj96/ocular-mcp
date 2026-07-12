import type { Config } from 'tailwindcss';

// Design tokens per research & planning/06-brand-identity.md §6 (Round 2
// revision) — neutral grayscale surfaces (no navy/blue hue cast, per Linear/
// Raycast reference screenshots), one kept accent (violet + motion-only cyan).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#0A0A0B',
          elevated: '#131315',
          raised: '#1C1C1F',
        },
        text: {
          primary: '#F2F2F0',
          secondary: '#8F8F94',
        },
        border: {
          DEFAULT: '#2A2A2E',
        },
        accent: {
          DEFAULT: '#8C7DFF',
          glow: '#5EEAD4',
        },
      },
      fontFamily: {
        display: ['"Geist Sans"', '"General Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        measure: '75ch',
      },
      fontSize: {
        'display-lg': ['clamp(3rem, 2rem + 5vw, 7rem)', { lineHeight: '0.98', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(1.75rem, 1.4rem + 1.6vw, 2.75rem)', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
