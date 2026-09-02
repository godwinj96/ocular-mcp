import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { frameDiff } from './motion-capture.js';

const WIDTH = 400;
const HEIGHT = 300;

async function solidFrame(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

// A dark background with a small bright box at (x, y) — mimics the real
// bug's shape: a small moving UI element against a large static background.
async function frameWithBox(boxX: number): Promise<Buffer> {
  const bg = sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 17, g: 17, b: 17 } },
  });
  const box = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 74, g: 222, b: 128 } },
  })
    .png()
    .toBuffer();
  return bg
    .composite([{ input: box, left: boxX, top: 130 }])
    .png()
    .toBuffer();
}

describe('frameDiff (max-block, not whole-frame-average)', () => {
  it('reports ~0 for identical frames', async () => {
    const frame = await solidFrame(50, 50, 50);
    const diff = await frameDiff(frame, frame);
    expect(diff).toBeLessThan(0.01);
  });

  it('reports a high diff for two completely different solid colors', async () => {
    const a = await solidFrame(0, 0, 0);
    const b = await solidFrame(255, 255, 255);
    const diff = await frameDiff(a, b);
    expect(diff).toBeGreaterThan(0.9);
  });

  // Regression test for the real bug found via live testing (Session 21):
  // a global whole-frame average diluted a small moving box's motion to
  // ~0.008-0.01 even though it moved hundreds of pixels — never crossing
  // the schema's default 0.05 threshold, so a genuinely animating page was
  // reported as static. The max-block metric must stay sensitive to this
  // exact shape of change: small element, large static background.
  it('detects a small box moving a large distance across a mostly-static frame', async () => {
    const before = await frameWithBox(20);
    const after = await frameWithBox(300); // moved most of the frame width
    const diff = await frameDiff(before, after);
    expect(diff).toBeGreaterThan(0.05); // must clear the schema's own default threshold
  });

  it('reports a low diff when the box has barely moved', async () => {
    const before = await frameWithBox(20);
    const after = await frameWithBox(22); // 2px shift — genuinely negligible
    const diff = await frameDiff(before, after);
    expect(diff).toBeLessThan(0.05);
  });

  // Regression test for the real, documented limitation found via live
  // testing against gradpreneur.ai (Session 22): a thin, fast rotating
  // stroke (a loading spinner) only occupies a small fraction of an 8x8
  // block, diluting even full-contrast motion below the schema's default
  // 0.05 threshold — the same dilution shape as the box-diff bug above, one
  // level down. Finer 4x4 blocks (Session 24) must catch this shape.
  async function frameWithThinLine(rotationDeg: number): Promise<Buffer> {
    const bg = sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 17, g: 17, b: 17 } },
    });
    // A thin 2px-wide, 24px-long stroke, rotated — mimics a spinner segment.
    const stroke = await sharp({
      create: { width: 2, height: 24, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .rotate(rotationDeg, { background: { r: 17, g: 17, b: 17 } })
      .png()
      .toBuffer();
    return bg
      .composite([{ input: stroke, left: WIDTH / 2 - 15, top: HEIGHT / 2 - 15 }])
      .png()
      .toBuffer();
  }

  it('detects a thin rotating stroke (spinner-shaped motion)', async () => {
    const before = await frameWithThinLine(0);
    const after = await frameWithThinLine(90); // quarter-turn — a real, substantial rotation
    const diff = await frameDiff(before, after);
    expect(diff).toBeGreaterThan(0.05);
  });
});
