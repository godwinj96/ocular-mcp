import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router.js';
// Self-hosted Geist Sans/Mono — the tailwind.config.ts fontFamily stack
// declared these since Round 2 but no actual font file was ever loaded
// (silently falling back to system fonts). @fontsource ships the real woff2
// files + font-display: swap, no external CDN request.
//
// TWO CORRECTIONS, round 8, both found by measuring rather than reading:
//
//   - geist-sans 700 was loaded and used ZERO times. `font-bold` appears
//     nowhere in src/; the only 700s on the site are in specimen.css, which
//     runs Inter/system on purpose. 35,484 bytes shipped for nothing since
//     round 2. Gone.
//   - geist-sans 500 was NOT loaded and is used THIRTEEN times. Per CSS
//     font-matching a requested 500 with no 500 face falls back to 400, so
//     every `font-medium` on the site — every H2, every FAQ question, every
//     how-it-works heading, the bridge's dim clause — has been rendering at
//     400 for four rounds. section-header.tsx's comment insisting "Weight is
//     500, NOT 600 ... do not 'fix' this" described a rendering that had
//     never once happened. Now it does.
//
// Outfit is the wordmark's face, confirmed by measuring glyph advances out of
// logo.svg's outlined paths against six candidates: Outfit 600 matches to
// within 0.8% per glyph, an order of magnitude closer than anything else
// tested. Loading it puts the logo's voice on the page's controls so the mark
// stops reading as a foreign object in the bar.
//
// Static weights, not the variable font: 400 + 600 static is 28,172 bytes,
// which is SMALLER than the single variable file (32,292) and skips variable
// rasterisation. Net against dropping the dead 700, the third family costs
// −7.1 KB; the +26.8 KB in this change is the price of the 500 bug, not of
// Outfit.
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@ocular/design-tokens/tokens.css';
import './styles/tokens.css';
import './styles/specimen.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
