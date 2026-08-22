import { describe, expect, test } from 'vitest';
import { validateMotionLedger, spendAtFrame, MotionEntry } from '../src/systems/MotionLedger.js';

describe('MotionLedger', () => {
  test('spendAtFrame sums active entries by class cost', () => {
    const entries: MotionEntry[] = [
      { id: 'a', class: 'primary', startFrame: 0, endFrame: 10 },
      { id: 'b', class: 'ambient', startFrame: 0, endFrame: 10 },
    ];
    expect(spendAtFrame(entries, 5)).toBeCloseTo(0.8);
    expect(spendAtFrame(entries, 10)).toBe(0);
  });

  test('throws when budget exceeds 1.0 (§I.5)', () => {
    const entries: MotionEntry[] = [
      { id: 'a', class: 'primary', startFrame: 0, endFrame: 10 },
      { id: 'b', class: 'subordinate', startFrame: 0, endFrame: 10 },
      { id: 'c', class: 'subordinate', startFrame: 0, endFrame: 10 },
    ];
    expect(() => validateMotionLedger(entries, { totalFrames: 10 })).toThrow(/> 1.0/);
  });

  test('throws when a new primary starts before the prior primary decelerates (§I.5 rule 3)', () => {
    const entries: MotionEntry[] = [
      { id: 'a', class: 'primary', startFrame: 0, endFrame: 100 }, // decel starts at frame 70
      { id: 'b', class: 'primary', startFrame: 50, endFrame: 150 },
    ];
    expect(() => validateMotionLedger(entries, { totalFrames: 150 })).toThrow(/deceleration phase/);
  });

  test('allows a new primary once the prior primary has entered deceleration and ended', () => {
    // Non-overlapping in ledger terms (b starts exactly when a ends) so this
    // isolates the sequencing rule from the independent >1.0 budget rule —
    // two concurrently-active primaries (0.7 + 0.7) would violate budget
    // regardless of sequencing, which is a separate, also-real constraint.
    const entries: MotionEntry[] = [
      { id: 'a', class: 'primary', startFrame: 0, endFrame: 100 }, // decel starts at frame 70
      { id: 'b', class: 'primary', startFrame: 100, endFrame: 200 },
    ];
    expect(() => validateMotionLedger(entries, { totalFrames: 200 })).not.toThrow();
  });

  test('throws with more than two concurrent ambient motions', () => {
    const entries: MotionEntry[] = [
      { id: 'a', class: 'ambient', startFrame: 0, endFrame: 10 },
      { id: 'b', class: 'ambient', startFrame: 0, endFrame: 10 },
      { id: 'c', class: 'ambient', startFrame: 0, endFrame: 10 },
    ];
    expect(() => validateMotionLedger(entries, { totalFrames: 10 })).toThrow(/concurrent ambient/);
  });

  test('throws on overspend during a Clarity/Conviction range (§I.5 rule 5)', () => {
    const entries: MotionEntry[] = [{ id: 'a', class: 'subordinate', startFrame: 0, endFrame: 10 }];
    expect(() =>
      validateMotionLedger(entries, { totalFrames: 10, clarityConvictionRanges: [[0, 10]] }),
    ).toThrow(/Clarity\/Conviction/);
  });
});
