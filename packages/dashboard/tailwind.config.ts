import type { Config } from 'tailwindcss';

// Mirrors packages/website/tailwind.config.ts so the dashboard reads as the
// same product, not a bolted-on separate app. Kept as its own file (not
// imported cross-package) per docs/rules/02-repo-structure.md — website and
// dashboard are separate deployables that never share runtime code.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { base: '#0A0A0B', elevated: '#131315', raised: '#1C1C1F' },
        text: { primary: '#F2F2F0', secondary: '#8F8F94' },
        border: { DEFAULT: '#2A2A2E' },
        accent: { DEFAULT: '#8C7DFF', glow: '#5EEAD4' },
      },
      fontFamily: {
        display: ['"Geist Sans"', '"General Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
