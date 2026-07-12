import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
// Self-hosted Geist Sans/Mono — the tailwind.config.ts fontFamily stack
// declared these since Round 2 but no actual font file was ever loaded
// (silently falling back to system fonts). @fontsource ships the real woff2
// files + font-display: swap, no external CDN request. Only the weights
// actually used in the UI (400/600/700 sans, 400/500 mono).
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-sans/latin-700.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import './styles/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
