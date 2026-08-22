import { describe, expect, test } from 'vitest';
import {
  computeBeatStarts,
  sequencePlanTotalFrames,
  validatePlan,
} from '../src/compositions/SequenceRenderer.js';
import type { BeatSpec, SequencePlan } from '../src/compositions/types.js';
import { T } from '../src/tokens/temporal.js';

function beat(overrides: Partial<BeatSpec> & Pick<BeatSpec, 'id' | 'stage'>): BeatSpec {
  return {
    frames: T.scenic,
    boundaryOut: 'FieldHandoff',
    render: () => null,
    ...overrides,
  };
}

function planWith(beats: BeatSpec[], loop = false): SequencePlan {
  return { id: 'test', width: 100, height: 100, loop, beats };
}

describe('SequenceRenderer.validatePlan', () => {
  test('accepts a plan with Discovery at ~50% and >=40% post-Discovery time', () => {
    // Discovery beat's absolute start (after subtracting boundary overlap
    // from the preceding Beat) lands at 198/430 = ~46%, inside 45-55%, with
    // (430-198)/430 = ~54% post-Discovery time (>= the 40% floor).
    const plan = planWith([
      beat({ id: 'b1', stage: 'Tension', frames: 230, awarenessState: 'L1' }),
      beat({ id: 'b2', stage: 'Discovery', frames: T.scenic, awarenessState: 'L2' }),
      beat({ id: 'b3', stage: 'Clarity/Conviction', frames: 200 }),
    ]);
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).not.toThrow();
  });

  test('rejects Discovery placed too early', () => {
    const plan = planWith([
      beat({ id: 'b1', stage: 'Discovery', frames: T.scenic, awarenessState: 'L2' }),
      beat({ id: 'b2', stage: 'Empowerment', frames: T.scenic * 4 }),
    ]);
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).toThrow(/45-55%/);
  });

  test('rejects a Beat shorter than t-scenic', () => {
    const plan = planWith([beat({ id: 'b1', stage: 'Hook', frames: 10 })]);
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).toThrow(/is 10f/);
  });

  test('rejects two consecutive AttentionTraverse boundaries', () => {
    const plan = planWith([
      beat({ id: 'b1', stage: 'A', frames: T.scenic, boundaryOut: 'AttentionTraverse' }),
      beat({ id: 'b2', stage: 'B', frames: T.scenic, boundaryOut: 'AttentionTraverse' }),
      beat({ id: 'b3', stage: 'C', frames: T.scenic }),
    ]);
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).toThrow(/AttentionTraverse/);
  });

  test('loop:true requires first and last Beat to both declare awarenessState L3 (§II.11 rule 8)', () => {
    const plan = planWith(
      [
        beat({ id: 'b1', stage: 'Conviction', frames: T.scenic, awarenessState: 'L0' }),
        beat({ id: 'b2', stage: 'Conviction', frames: T.scenic, awarenessState: 'L3' }),
      ],
      true,
    );
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).toThrow(/Field parity/);
  });

  test('loop:true passes when first and last Beat are both L3', () => {
    const plan = planWith(
      [
        beat({ id: 'b1', stage: 'Conviction', frames: T.scenic, awarenessState: 'L3' }),
        beat({ id: 'b2', stage: 'Conviction', frames: T.scenic, awarenessState: 'L3' }),
      ],
      true,
    );
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).not.toThrow();
  });

  test("rejects motion ending inside the final Beat's required terminal stillness", () => {
    const plan = planWith([
      beat({
        id: 'b1',
        stage: 'Conviction',
        frames: T.scenic,
        motionEntries: [{ id: 'late', class: 'primary', startFrame: 0, endFrame: T.scenic - 10 }],
      }),
    ]);
    const starts = computeBeatStarts(plan);
    const total = sequencePlanTotalFrames(plan);
    expect(() => validatePlan(plan, starts, total)).toThrow(/stillness/);
  });
});
