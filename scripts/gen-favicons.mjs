// One-shot generator for packages/website/public favicons. Kept out of the
// repo: the mark is the source of truth (src/components/mark.tsx) and this
// only exists to re-derive the rasters when that mark changes.
//
// The asset it replaces was a 1054x1040 raster TRACE of the mark on #0A0E14 —
// a ground that matches nothing in tokens.css, with visibly ragged circle
// edges, downscaled by the browser to 16px. Both faults are fixed by going
// back to the vector.
//
// Two optical sizes, not one. At 16px the crescent — the detail that makes the
// glyph an EYE rather than an O — is sub-pixel, so the 16 is drawn with a
// tighter inset to spend every pixel available on the glyph. Above 32px the
// crescent resolves and the wider inset reads better in a tab strip.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const src = readFileSync('packages/website/src/components/mark.tsx', 'utf8');
const m = src.match(/<path\s+d="([^"]+)"/s);
if (!m) throw new Error('mark path not found in mark.tsx');
const d = m[1];

// The Mark's own viewBox, straight from mark.tsx.
const [vx, vy, vw] = [54.66, 60, 305.45];
const TILE = 512;

// Ground and glyph are --surface-base and --text-primary from tokens.css.
const svg = (insetPct) => {
  const inset = Math.round(TILE * insetPct);
  const s = (TILE - inset * 2) / vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}" width="${TILE}" height="${TILE}">
  <rect width="${TILE}" height="${TILE}" fill="#09090b"/>
  <g transform="translate(${(inset - vx * s).toFixed(3)},${(inset - vy * s).toFixed(3)}) scale(${s.toFixed(6)})">
    <g transform="translate(40,360.0) scale(0.418994,-0.418994)" fill="#f4f4f2">
      <path d="${d}"/>
    </g>
  </g>
</svg>
`;
};

const WIDE = svg(0.14);
const TIGHT = svg(0.1);

writeFileSync('packages/website/public/favicon.svg', WIDE);

const raster = async (source, size, name) =>
  sharp(Buffer.from(source), { density: 900 })
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(`packages/website/public/${name}`);

await raster(TIGHT, 16, 'favicon-16.png');
await raster(WIDE, 32, 'favicon-32.png');
await raster(WIDE, 180, 'apple-touch-icon.png');
await raster(WIDE, 512, 'favicon-512.png');

console.log('favicons written');
