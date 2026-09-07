// One-shot generator for packages/website/public/og-image.png — the social
// card index.html's og:image/twitter:image meta tags already point at
// (docs/rules referenced it as a known gap: "Every social card the site
// produces is a broken image").
//
// TEXT-FREE ON PURPOSE. The wordmark's letterforms are vector paths lifted
// straight from src/components/wordmark.tsx (same "generated, never retyped"
// rule that file documents for itself) — sharp rasterises via librsvg, which
// has no access to the self-hosted Geist Sans woff2 this project ships (that
// font reaches a browser via @fontsource's CSS, never installed as a system
// font), so any additional headline text drawn into this image would silently
// fall back to whatever generic sans happens to be on the machine that ran
// this script. A wrong-font OG card reads as broken in exactly the way this
// script exists to fix. Twitter/Facebook/LinkedIn already render og:title and
// og:description as real text next to the image using the platform's own
// font — the image's job is just to be recognisably Ocular's, which the mark
// and wordmark alone already do.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const src = readFileSync('packages/website/src/components/wordmark.tsx', 'utf8');

// Six glyph paths (O/eye, c, u, l, a, r), each already carrying its own
// translate() — see wordmark.tsx's own header comment for why extracting only
// the `d` attributes and dropping the transforms breaks the layout.
const paths = [...src.matchAll(/<path\s+d="([^"]+)"\s+transform="([^"]+)"/gs)].map(
  ([, d, transform]) => `<path d="${d}" transform="${transform}"/>`,
);
if (paths.length !== 6) {
  throw new Error(`Expected 6 wordmark glyph paths, found ${paths.length} — wordmark.tsx shape changed`);
}

const WIDTH = 1200;
const HEIGHT = 630;

// The wordmark's own viewBox and inner-group transform, straight from
// wordmark.tsx — the six paths above are only meaningful inside this frame.
const [VB_W, VB_H] = [1377.6, 420.0];
const INNER = 'translate(40,360.0) scale(0.418994,-0.418994)';

// Scale the wordmark to occupy a generous two-thirds of the card width,
// centered, with the mark's own optical weight (rather than the full bounding
// box) roughly centering it vertically too.
const markScale = (WIDTH * 0.62) / VB_W;
const markW = VB_W * markScale;
const markH = VB_H * markScale;
const markX = (WIDTH - markW) / 2;
const markY = (HEIGHT - markH) / 2;

// Ground and glyph are --surface-base and --accent from tokens.css — the same
// silver the live site renders the wordmark in (nav.tsx wraps it in
// `text-accent`), not the higher-contrast off-white gen-favicons.mjs uses for
// the 16px favicon glyph, which was a deliberate exception for a size this
// card doesn't share.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#09090b"/>
  <g transform="translate(${markX.toFixed(3)},${markY.toFixed(3)}) scale(${markScale.toFixed(6)})">
    <g transform="${INNER}" fill="#c7c7ce">
      ${paths.join('\n      ')}
    </g>
  </g>
</svg>
`;

await sharp(Buffer.from(svg), { density: 300 })
  .resize(WIDTH, HEIGHT)
  .png({ compressionLevel: 9 })
  .toFile('packages/website/public/og-image.png');

console.log('og-image.png written');
