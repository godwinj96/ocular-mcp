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

// Mirrors packages/worker/src/extractors/motion-capture.test.ts's cases —
// same duplicated logic, held to the same regression contract.
describe('frameDiff (local path, max-block, not whole-frame-average)', () => {
  it('reports ~0 for identical frames', async () => {
    const frame = await solidFrame(50, 50, 50);
    expect(await frameDiff(frame, frame)).toBeLessThan(0.01);
  });

  it('reports a high diff for two completely different solid colors', async () => {
    const a = await solidFrame(0, 0, 0);
    const b = await solidFrame(255, 255, 255);
    expect(await frameDiff(a, b)).toBeGreaterThan(0.9);
  });

  it('detects a small box moving a large distance across a mostly-static frame', async () => {
    const before = await frameWithBox(20);
    const after = await frameWithBox(300);
    expect(await frameDiff(before, after)).toBeGreaterThan(0.05);
  });

  it('reports a low diff when the box has barely moved', async () => {
    const before = await frameWithBox(20);
    const after = await frameWithBox(22);
    expect(await frameDiff(before, after)).toBeLessThan(0.05);
  });

  // Mirrors the worker package's identical regression case for the
  // spinner-class gap found live against gradpreneur.ai (Session 22),
  // addressed by the finer 4x4 diff grid (Session 24).
  async function frameWithThinLine(rotationDeg: number): Promise<Buffer> {
    const bg = sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 17, g: 17, b: 17 } },
    });
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
    const after = await frameWithThinLine(90);
    expect(await frameDiff(before, after)).toBeGreaterThan(0.05);
  });
});
