import type { Config } from 'tailwindcss';

// The Tailwind mirror of tokens.css. tokens.css is the source of truth; this
// file exposes those values to Tailwind's class generator and adds nothing of
// its own.
//
// WHY THIS IS A PACKAGE AND NOT TWO FILES. It was two files, and they drifted:
// the dashboard sat on #0A0A0B/#131315/#1C1C1F against the site's
// #09090b/#121214/#1a1a1d -- near-misses, not deliberate differences, which
// read as sloppiness to anyone moving between the two surfaces in one session.
// Duplication is what allowed that, so the duplication is what got removed.
//
// This does not weaken the website<->dashboard isolation in
// docs/rules/02-repo-structure.md: a preset is consumed at BUILD time, compiles
// to CSS, and contributes no JavaScript to either bundle. The dashboard already
// imports @ocular/shared at RUNTIME for PLAN_PRICE_USD, which is strictly
// stronger coupling than this.
export const ocularPreset = {
  content: [],
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
        // Three weights, three jobs -- see tokens.css. One border colour doing
        // all three is what made the dashboard's key list read as four boxes
        // instead of one table.
        rule: {
          structural: '#202024', // the page's spine
          divider: '#17171A', // rows of one thing
          mark: '#2C2C31', // this object has an edge
        },
        accent: {
          DEFAULT: '#C7C7CE',
          hover: '#DEDEE4',
          active: '#ABABB4',
        },
        // The instrument's three lamps. `signal` is "live"; the other two are
        // the app layer. Never used as decoration, never as a fill.
        signal: {
          DEFAULT: '#5EEAD4',
          ink: '#0B6B60',
        },
        caution: '#E8B84B',
        fault: '#EE7A66',
      },
      // Pointed at tokens.css rather than repeating the stacks, so
      // hand-written CSS (prose.css) and Tailwind classes cannot drift apart.
      // Same emitted font-family either way.
      fontFamily: {
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
        // The wordmark's own face, extended onto controls and nothing else.
        // Headings and all mono are deliberately NOT in this stack -- and in
        // an article it appears nowhere at all, see prose.css.
        brand: 'var(--font-brand)',
      },
      maxWidth: {
        // `measure: '68ch'` was here, unused, and delivered 99 characters
        // rather than 68 -- see tokens.css for the measurement. Replaced by
        // two named px measures with documented jobs.
        prose: 'var(--measure-prose)',
        answer: 'var(--measure-answer)',
        'prose-bleed': 'var(--prose-bleed)',
        deck: '40ch',
        demo: '1400px',
        app: 'var(--app-measure)',
        rail: 'var(--rail-max)',
      },
      spacing: {
        sec: 'var(--sec-gap)',
        'sec-tail': 'var(--sec-tail)',
        group: 'var(--group)',
        'stack-0': 'var(--stack-0)',
        'stack-1': 'var(--stack-1)',
        'stack-2': 'var(--stack-2)',
        'stack-3': 'var(--stack-3)',
        'stack-4': 'var(--stack-4)',
        app: 'var(--app-inset)',
        bar: 'var(--app-bar-h)',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        base: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        acquire: 'var(--ease-acquire)',
      },
      transitionDuration: {
        fast: '100ms',
        DEFAULT: '160ms',
      },
    },
  },
} satisfies Config;

export default ocularPreset;
