import type { Config } from 'tailwindcss';

// Mirrors src/styles/tokens.css — see that file for the reasoning behind the
// three-weight rule system and the closed four-value text ladder.
//
// `display-lg` (clamp(3rem, 2rem + 5vw, 7rem)) is deliberately deleted rather
// than merely unused: it existed only to tempt a future pass back into the
// 7rem-headline register the Instrument concept rejects. The H1 scale now
// lives inline in hero.tsx, bounded by the H1:body ratio the concept actually
// protects (~2.6-3.1x), not by a free-floating display step.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#09090B',
          elevated: '#121214',
          raised: '#1A1A1D',
        },
        text: {
          primary: '#F4F4F2',
          secondary: '#A1A1A8',
          tertiary: '#86868C',
          quaternary: '#6C6C72',
          inactive: '#3A3A40',
        },
        rule: {
          structural: '#202024',
          divider: '#17171A',
          mark: '#2C2C31',
        },
        accent: {
          DEFAULT: '#8C7DFF',
          hover: '#9D90FF',
          active: '#7E6EF0',
          glow: '#5EEAD4',
        },
      },
      fontFamily: {
        display: ['"Geist Sans"', '"General Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        measure: '68ch',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      // One easing, two durations — see tokens.css.
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        base: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      transitionDuration: {
        fast: '100ms',
        DEFAULT: '160ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
