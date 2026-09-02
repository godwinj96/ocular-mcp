// motion_capture extractor — local path. Same sampling design as
// packages/worker/src/extractors/motion-capture.ts (see that file's header
// comment for the full rationale) — deliberately duplicated, not shared,
// same rationale as this package's other extractors.
//
// Scroll simulation uses HeadlessShellPage.wheel() (a real CDP
// Input.dispatchMouseEvent), not window.scrollTo() via evaluate — the same
// Lenis/Locomotive-Scroll gotcha applies regardless of engine.

import sharp from 'sharp';
import type { MotionCaptureInput, MotionCaptureOutput } from '@ocular/shared';
import type { HeadlessShellPage } from '../browser/headless-shell.js';
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

const SCROLL_SCRUBBED_STEPS = 10;
const SCROLL_SETTLE_MS = 60;
const SCROLL_TRIGGER_SETTLE_MS = 300;

const DIFF_SAMPLE_EDGE_PX = 48;
// 12x12 (was 6x6) — mirrors packages/worker's identical comment: finer
// blocks are more sensitive to a thin, fast-moving stroke (e.g. a spinner)
// that only covers a small fraction of a coarser block even at full
// contrast. Session 22's documented limitation, addressed here.
const DIFF_GRID_BLOCKS = 12;

const TILE_CELL_W = 240;
const TILE_CELL_H = 180;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Max-block diff, not a whole-frame average — see
// packages/worker/src/extractors/motion-capture.ts's identical function for
// the full rationale (found via live testing: a global average dilutes a
// small moving element's motion below any reasonable threshold). Exported
// for motion-capture.test.ts, same reasoning as the cloud-path file.
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

async function wheelScrollTo(
  page: HeadlessShellPage,
  targetY: number,
  currentY: number,
): Promise<void> {
  const delta = targetY - currentY;
  const steps = 6;
  const perStep = delta / steps;
  for (let i = 0; i < steps; i++) {
    await page.wheel(0, perStep);
    await wait(30);
  }
}

async function getScrollMetrics(
  page: HeadlessShellPage,
): Promise<{ scrollY: number; maxScrollY: number }> {
  return page.evaluate(
    '({ scrollY: window.scrollY, maxScrollY: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) })',
  );
}

async function sampleTimeBased(
  page: HeadlessShellPage,
  durationMs: number,
  intervalMs: number,
  maxFrames: number,
): Promise<RawFrame[]> {
  const frames: RawFrame[] = [];
  const start = Date.now();
  while (Date.now() - start < durationMs && frames.length < maxFrames) {
    const raw = await page.screenshot({ fullPage: false });
    frames.push({ raw, tMs: Date.now() - start });
    await wait(intervalMs);
  }
  return frames;
}

async function sampleScrollScrubbed(page: HeadlessShellPage, steps: number): Promise<RawFrame[]> {
  const { maxScrollY } = await getScrollMetrics(page);
  const frames: RawFrame[] = [];
  const start = Date.now();
  let currentY = 0;

  for (let i = 0; i <= steps; i++) {
    const targetY = Math.round((maxScrollY * i) / steps);
    await wheelScrollTo(page, targetY, currentY);
    currentY = targetY;
    await wait(SCROLL_SETTLE_MS);
    const raw = await page.screenshot({ fullPage: false });
    frames.push({ raw, tMs: Date.now() - start, scrollY: currentY });
  }
  return frames;
}

async function sampleScrollTriggered(
  page: HeadlessShellPage,
  durationMs: number,
  intervalMs: number,
  maxFrames: number,
): Promise<RawFrame[]> {
  const { maxScrollY } = await getScrollMetrics(page);
  await wheelScrollTo(page, maxScrollY, 0);
  await wait(SCROLL_TRIGGER_SETTLE_MS);
  const frames = await sampleTimeBased(page, durationMs, intervalMs, maxFrames);
  return frames.map((f) => ({ ...f, scrollY: maxScrollY }));
}

async function diffFilter(
  frames: RawFrame[],
  threshold: number,
  maxTiles: number,
): Promise<RawFrame[]> {
  if (frames.length === 0) return [];
  const kept: RawFrame[] = [frames[0]!];
  for (let i = 1; i < frames.length && kept.length < maxTiles; i++) {
    const frame = frames[i]!;
    const diff = await frameDiff(kept[kept.length - 1]!.raw, frame.raw);
    if (diff >= threshold) kept.push(frame);
  }
  return kept;
}

// See packages/worker/src/extractors/motion-capture.ts's identical
// function for the full rationale (a real usability finding: the tile
// grid's reading order is otherwise invisible in the image itself).
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

async function tileFrames(frames: RawFrame[]): Promise<{ buffer: Buffer; w: number; h: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(frames.length)));
  const rows = Math.max(1, Math.ceil(frames.length / cols));

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

  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([...cellComposite, ...labelComposite])
    .png()
    .toBuffer();

  return { buffer, w: width, h: height };
}

async function sample(page: HeadlessShellPage, input: MotionCaptureInput): Promise<RawFrame[]> {
  if (input.scrollSampling === 'scroll-scrubbed') {
    return sampleScrollScrubbed(page, SCROLL_SCRUBBED_STEPS);
  }
  if (input.scrollSampling === 'scroll-triggered') {
    const durationMs =
      input.mode === 'analysis' ? ANALYSIS_MAX_DURATION_MS : VERIFICATION_MAX_DURATION_MS;
    const intervalMs =
      input.mode === 'analysis' ? Math.round(1000 / input.fps) : VERIFICATION_SAMPLE_INTERVAL_MS;
    const maxFrames = input.mode === 'analysis' ? ANALYSIS_MAX_FRAMES : VERIFICATION_MAX_TILES * 4;
    return sampleScrollTriggered(page, durationMs, intervalMs, maxFrames);
  }
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
  page: HeadlessShellPage,
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
