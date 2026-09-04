// motion_capture extractor. See docs/rules/05-worker-and-browser-pipeline.md §4b.
//
// Two sampling axes, orthogonal to each other:
//   - mode: verification (diff-triggered contact sheet) vs. analysis (fixed
//     high-fps full-size frames).
//   - scrollSampling: time (default) vs. scroll-scrubbed (sample by scroll
//     offset, for parallax/pinned/scroll-timeline animation) vs.
//     scroll-triggered (scroll to the trigger point, hold, then time-sample).
//
// Scroll simulation uses page.mouse.wheel(), not page.evaluate(() =>
// window.scrollTo(...)) — the documented gotcha in §4b is that JS
// smooth-scroll libraries (Lenis, Locomotive Scroll) hijack native scroll
// and may not respond to a programmatic scrollTop change; a real wheel
// event drives both native scroll and hijacked-scroll libraries the same
// way a user's mouse would.
//
// All bounds (durations, frame/tile counts, sample intervals) are file-local
// tuning constants, same precedent as design-tokens.ts's MAX_ELEMENTS_WALKED
// — not promoted to shared/constants.ts since they're this extractor's own
// sampling-algorithm internals, not a cross-cutting contract.

import sharp from 'sharp';
import type { MotionCaptureInput, MotionCaptureOutput } from '@ocular/shared';
import type { Page } from '../providers/self-hosted-provider.js';
import { encodeScreenshot } from '../image/pipeline.js';

interface RawFrame {
  raw: Buffer;
  tMs: number;
  scrollY?: number;
}

const VERIFICATION_SAMPLE_INTERVAL_MS = 80;
const VERIFICATION_MAX_DURATION_MS = 1600;
const VERIFICATION_MAX_TILES = 12;

const ANALYSIS_MAX_DURATION_MS = 2000;
const ANALYSIS_MAX_FRAMES = 48;

// Frames, not intervals. The loop below walks i = 0..SAMPLES-1 inclusive,
// so this is exactly how many tiles a scroll-scrubbed sheet comes back with.
// It was previously a step count and produced SAMPLES+1 frames -- 11 for a
// nominal 10, which is prime and therefore untileable without empty cells.
//
// This is the DEFAULT, not the only value: `input.samples` overrides it per
// call (see the shared schema). It stays 10 because lowering the default
// would quietly make every existing caller's capture lossier to suit one
// caller that wanted a shorter sheet.
const SCROLL_SCRUBBED_SAMPLES = 10;
const SCROLL_SETTLE_MS = 60;
const SCROLL_TRIGGER_SETTLE_MS = 300;

const DIFF_SAMPLE_EDGE_PX = 48; // downscale target before pixel-diffing — cheap and sufficient to detect real motion.
// 12x12 blocks over the downscaled frame (4x4px each at the edge size
// above). Was 6x6/8x8px until a real, documented limitation (Session 22,
// gradpreneur.ai's loading spinner): a thin, fast-moving stroke (a rotating
// 1-2px-wide line) only covers a small fraction of an 8x8 block even at
// full contrast, so its block-average diff sat below the schema's default
// 0.05 threshold — the same dilution bug the max-block fix solved for
// whole-frame averaging, one level down. Finer blocks raise a thin
// element's local density inside whichever block it occupies. Not a
// complete fix for every thin/fast case (an extremely fast rotation could
// still straddle multiple blocks each sampling interval), but verified via
// frame-diff.test.ts to catch the specific shape of the reported gap.
const DIFF_GRID_BLOCKS = 12;

const TILE_CELL_W = 240;
const TILE_CELL_H = 180;
// Widest sheet we will emit. 6 x 240px = 1440px, still inside the ~1568px
// long edge past which a model gains no accuracy and only spends tokens.
const MAX_TILE_COLS = 6;

// Max-block diff, not a whole-frame average. Found via live testing (a real
// bug, not a hypothetical): a small moving element (e.g. a 100px box in a
// 1280px-wide frame) changes only a tiny fraction of total pixels — a
// global average dilutes that motion to ~0.01 even when the element moves
// its entire width, never crossing a 0.02-0.05 threshold. Splitting the
// frame into blocks and taking the single most-changed block's average
// instead means genuine localized motion (the common case: a button, an
// icon, a small UI element) is detected the way a human glance would
// notice it, not averaged away by a mostly-static background.
// Exported for frame-diff.test.ts — the whole-frame-average-vs-max-block
// bug this replaced was invisible to any test that only checks "does the
// function run," so it needs direct, synthetic-image coverage independent
// of the browser-dependent live verification.
export async function frameDiff(a: Buffer, b: Buffer): Promise<number> {
  const size = DIFF_SAMPLE_EDGE_PX;
  const channels = 3;
  const [ra, rb] = await Promise.all([
    sharp(a).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
    sharp(b).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
  ]);

  const blockSize = Math.max(1, Math.floor(size / DIFF_GRID_BLOCKS));
  let maxBlockDiff = 0;

  for (let by = 0; by < DIFF_GRID_BLOCKS; by++) {
    for (let bx = 0; bx < DIFF_GRID_BLOCKS; bx++) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < blockSize; y++) {
        const py = by * blockSize + y;
        if (py >= size) break;
        for (let x = 0; x < blockSize; x++) {
          const px = bx * blockSize + x;
          if (px >= size) break;
          const idx = (py * size + px) * channels;
          for (let c = 0; c < channels; c++) {
            sum += Math.abs((ra[idx + c] ?? 0) - (rb[idx + c] ?? 0));
          }
          count += channels;
        }
      }
      const blockAvg = count === 0 ? 0 : sum / (count * 255);
      if (blockAvg > maxBlockDiff) maxBlockDiff = blockAvg;
    }
  }

  return maxBlockDiff;
}

// Scrolls by wheel events (see header comment) toward `targetY`, in coarse
// steps, rather than one giant jump — closer to real user behavior and
// gives scroll-triggered animations a chance to fire partway through.
async function wheelScrollTo(page: Page, targetY: number, currentY: number): Promise<void> {
  const delta = targetY - currentY;
  const steps = 6;
  const perStep = delta / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, perStep);
    await page.waitForTimeout(30);
  }
}

async function getScrollMetrics(page: Page): Promise<{ scrollY: number; maxScrollY: number }> {
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    maxScrollY: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  }));
}

async function sampleTimeBased(
  page: Page,
  durationMs: number,
  intervalMs: number,
  maxFrames: number,
): Promise<RawFrame[]> {
  const frames: RawFrame[] = [];
  const start = Date.now();
  while (Date.now() - start < durationMs && frames.length < maxFrames) {
    const raw = await page.screenshot({ type: 'png' });
    frames.push({ raw, tMs: Date.now() - start });
    await page.waitForTimeout(intervalMs);
  }
  return frames;
}

async function sampleScrollScrubbed(page: Page, samples: number): Promise<RawFrame[]> {
  const { maxScrollY } = await getScrollMetrics(page);
  const frames: RawFrame[] = [];
  const start = Date.now();
  let currentY = 0;

  const lastIndex = Math.max(1, samples - 1);
  for (let i = 0; i < samples; i++) {
    const targetY = Math.round((maxScrollY * i) / lastIndex);
    await wheelScrollTo(page, targetY, currentY);
    currentY = targetY;
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    const raw = await page.screenshot({ type: 'png' });
    frames.push({ raw, tMs: Date.now() - start, scrollY: currentY });
  }
  return frames;
}

async function sampleScrollTriggered(
  page: Page,
  durationMs: number,
  intervalMs: number,
  maxFrames: number,
): Promise<RawFrame[]> {
  const { maxScrollY } = await getScrollMetrics(page);
  await wheelScrollTo(page, maxScrollY, 0);
  await page.waitForTimeout(SCROLL_TRIGGER_SETTLE_MS);
  // Trigger fired (presumably) — now time-sample its own clock, same as the
  // time-based path, just starting from the scrolled position.
  const frames = await sampleTimeBased(page, durationMs, intervalMs, maxFrames);
  return frames.map((f) => ({ ...f, scrollY: maxScrollY }));
}

function diffFilter(frames: RawFrame[], threshold: number, maxTiles: number): Promise<RawFrame[]> {
  return (async () => {
    if (frames.length === 0) return [];
    const kept: RawFrame[] = [frames[0]!];
    for (let i = 1; i < frames.length && kept.length < maxTiles; i++) {
      const frame = frames[i]!;
      const diff = await frameDiff(kept[kept.length - 1]!.raw, frame.raw);
      if (diff >= threshold) kept.push(frame);
    }
    return kept;
  })();
}

// Found via a real usability check (not a spec requirement, a direct "can I
// actually read this" test): the tile grid's reading order (row-major, left
// to right, top to bottom) is an implementation detail returned separately
// in `tiles[]` metadata — nothing in the rendered image itself indicates
// which tile is earliest. An agent (or a human) looking at just the image
// has no way to know whether tile 4 comes before or after tile 7 without
// cross-referencing a side-channel array by index, which is exactly the
// kind of silent misread that makes "verify the motion is roughly right"
// unreliable. Baking a visible "#index tMs" label into each cell removes
// that ambiguity — the image is self-describing without needing the
// metadata alongside it, though the metadata is still returned for anyone
// who wants exact numbers.
function tileLabelSvg(
  index: number,
  tMs: number,
  scrollY: number | undefined,
  w: number,
  h: number,
): Buffer {
  const text =
    scrollY !== undefined
      ? `#${index} ${tMs}ms scrollY=${Math.round(scrollY)}`
      : `#${index} ${tMs}ms`;
  const badgeWidth = Math.min(w, text.length * 6.2 + 8);
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${h - 16}" width="${badgeWidth}" height="16" fill="black" fill-opacity="0.65" />
    <text x="3" y="${h - 4}" font-family="monospace" font-size="11" fill="white">${text}</text>
  </svg>`;
  return Buffer.from(svg);
}

// Grid shape. `ceil(sqrt(n))` alone leaves ragged holes: ten frames land in a
// 4x3 grid with two empty cells, which reads as a broken image rather than as
// a sheet, and spends tile budget on nothing. So we prefer a factorisation
// that fills EVERY cell, taking the exact factor pair closest to square — a
// 12-frame sheet stays 4x3, a 10-frame one becomes 5x2. Pairs wider than
// MAX_TILE_COLS are rejected so a prime-ish count can't degenerate into a
// single 7-wide strip that blows past the model's ~1568px long-edge cap; a
// count with no usable exact pair (7, 11) falls back to the near-square shape
// and accepts the blanks.
function gridShape(frameCount: number): { cols: number; rows: number } {
  const n = Math.max(1, frameCount);
  let best: { cols: number; rows: number } | null = null;
  for (let rows = 1; rows * rows <= n; rows++) {
    if (n % rows !== 0) continue;
    const cols = n / rows;
    if (cols > MAX_TILE_COLS) continue;
    if (!best || cols / rows < best.cols / best.rows) best = { cols, rows };
  }
  if (best) return best;
  const near = Math.max(1, Math.ceil(Math.sqrt(n)));
  return { cols: near, rows: Math.max(1, Math.ceil(n / near)) };
}

// Separator lines on the internal cell boundaries.
//
// Without them adjacent frames of the same page bleed into one another —
// consecutive samples of an animation are by definition near-identical at the
// edges, so the seam between two tiles is invisible and the sheet reads as one
// smeared image rather than as N discrete moments. That is a correctness
// problem for the tool, not a cosmetic one: a model counting frames, or
// reasoning about what changed between two of them, first has to be able to
// tell where one ends.
//
// Mid-grey at 2px, deliberately: the tiles are screenshots of arbitrary pages,
// so the line has to hold against both a white page (5.2:1) and a near-black
// one (3.7:1). A black hairline disappears on dark UIs and a white one
// disappears on light ones.
const GRID_LINE_COLOR = '#6b6b6b';
const GRID_LINE_W = 2;

function gridLinesSvg(cols: number, rows: number, width: number, height: number): Buffer {
  const lines: string[] = [];
  for (let c = 1; c < cols; c++) {
    lines.push(
      `<rect x="${c * TILE_CELL_W - GRID_LINE_W / 2}" y="0" width="${GRID_LINE_W}" height="${height}" fill="${GRID_LINE_COLOR}"/>`,
    );
  }
  for (let r = 1; r < rows; r++) {
    lines.push(
      `<rect x="0" y="${r * TILE_CELL_H - GRID_LINE_W / 2}" width="${width}" height="${GRID_LINE_W}" fill="${GRID_LINE_COLOR}"/>`,
    );
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join('')}</svg>`,
  );
}

async function tileFrames(frames: RawFrame[]): Promise<{ buffer: Buffer; w: number; h: number }> {
  const { cols, rows } = gridShape(frames.length);

  const cells = await Promise.all(
    frames.map((f) =>
      sharp(f.raw).resize(TILE_CELL_W, TILE_CELL_H, { fit: 'cover' }).png().toBuffer(),
    ),
  );

  const width = TILE_CELL_W * cols;
  const height = TILE_CELL_H * rows;
  const cellComposite = cells.map((input, i) => ({
    input,
    left: (i % cols) * TILE_CELL_W,
    top: Math.floor(i / cols) * TILE_CELL_H,
  }));
  const labelComposite = frames.map((f, i) => ({
    input: tileLabelSvg(i, f.tMs, f.scrollY, TILE_CELL_W, TILE_CELL_H),
    left: (i % cols) * TILE_CELL_W,
    top: Math.floor(i / cols) * TILE_CELL_H,
  }));

  const gridComposite =
    cols > 1 || rows > 1
      ? [{ input: gridLinesSvg(cols, rows, width, height), left: 0, top: 0 }]
      : [];

  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([...cellComposite, ...gridComposite, ...labelComposite])
    .png()
    .toBuffer();

  return { buffer, w: width, h: height };
}

async function sample(page: Page, input: MotionCaptureInput): Promise<RawFrame[]> {
  if (input.scrollSampling === 'scroll-scrubbed') {
    return sampleScrollScrubbed(page, input.samples ?? SCROLL_SCRUBBED_SAMPLES);
  }
  if (input.scrollSampling === 'scroll-triggered') {
    const durationMs =
      input.mode === 'analysis' ? ANALYSIS_MAX_DURATION_MS : VERIFICATION_MAX_DURATION_MS;
    const intervalMs =
      input.mode === 'analysis' ? Math.round(1000 / input.fps) : VERIFICATION_SAMPLE_INTERVAL_MS;
    const maxFrames = input.mode === 'analysis' ? ANALYSIS_MAX_FRAMES : VERIFICATION_MAX_TILES * 4; // oversample before diff-filtering
    return sampleScrollTriggered(page, durationMs, intervalMs, maxFrames);
  }
  // time (default)
  if (input.mode === 'analysis') {
    return sampleTimeBased(
      page,
      ANALYSIS_MAX_DURATION_MS,
      Math.round(1000 / input.fps),
      ANALYSIS_MAX_FRAMES,
    );
  }
  return sampleTimeBased(
    page,
    VERIFICATION_MAX_DURATION_MS,
    VERIFICATION_SAMPLE_INTERVAL_MS,
    VERIFICATION_MAX_TILES * 4,
  );
}

export async function captureMotion(
  page: Page,
  input: MotionCaptureInput,
): Promise<MotionCaptureOutput> {
  const frames = await sample(page, input);

  if (input.mode === 'analysis') {
    const encoded = await Promise.all(frames.map((f) => encodeScreenshot(f.raw, 'balanced')));
    return {
      mode: 'analysis',
      frames: encoded.map((e, i) => ({
        tMs: frames[i]!.tMs,
        scrollY: frames[i]!.scrollY,
        b64: e.b64,
        mime: e.mime,
        w: e.w,
        h: e.h,
      })),
    };
  }

  const kept = await diffFilter(frames, input.diffThreshold, VERIFICATION_MAX_TILES);
  const tiled = await tileFrames(kept.length > 0 ? kept : frames.slice(0, 1));
  // Reuse the same size-budgeted encode step every other extractor uses —
  // "one tiled image, one image's token cost" (rules-05 §4b) means the
  // contact sheet must respect IMG_MAX_KB same as a single screenshot.
  const encoded = await encodeScreenshot(tiled.buffer, 'balanced');

  return {
    mode: 'verification',
    contactSheet: {
      b64: encoded.b64,
      mime: encoded.mime,
      w: encoded.w,
      h: encoded.h,
      bytes: encoded.bytes,
      tiles: kept.map((f) => ({ tMs: f.tMs, scrollY: f.scrollY })),
    },
  };
}
