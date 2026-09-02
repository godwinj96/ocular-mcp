// Near-invisible single-hue stroke icons — depth from line art, not
// elevation, per the "Instrument" concept (research & planning/moodboards/
// 2026-09-02-ocular-visual-identity.html), citing Linear's own feature-row
// treatment. Deliberately hand-authored, minimal, no icon library.
const SHARED_PROPS = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function IconScan() {
  return (
    <svg {...SHARED_PROPS}>
      <rect x="3" y="4" width="18" height="14" rx="1.5" />
      <path d="M3 15 L9 9 L13 12 L21 6" />
    </svg>
  );
}

export function IconFrames() {
  return (
    <svg {...SHARED_PROPS}>
      <rect x="3" y="5" width="12" height="9" rx="1" />
      <rect x="7" y="9" width="12" height="9" rx="1" />
      <rect x="11" y="13" width="9" height="6" rx="1" />
    </svg>
  );
}

export function IconGlobe() {
  return (
    <svg {...SHARED_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M4.5 10.5h15M4.5 14h15M12 3.5c-3 4-3 13 0 17c3-4 3-13 0-17Z" />
    </svg>
  );
}

export function IconNoAction() {
  return (
    <svg {...SHARED_PROPS}>
      <path d="M6 3 L6 19 L10.5 15.5 L13.5 20.5 L16 19 L13 14 L18 14 Z" />
      <path d="M4 4 L20 20" strokeWidth="1.2" />
    </svg>
  );
}
