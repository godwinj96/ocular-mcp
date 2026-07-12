import { describe, expect, it } from 'vitest';
import {
  DETAIL_MAX_EDGE_PX,
  EXHAUSTED_FAILURE_CHARGE,
  IMG_MAX_EDGE_PX,
  JOB_DEADLINE_MS,
  SERVER_AWAIT_MS,
  SUCCESS_CHARGE,
} from './constants.js';

describe('constants', () => {
  it('SERVER_AWAIT_MS is greater than JOB_DEADLINE_MS, per docs/rules/03-shared-contracts.md §3', () => {
    expect(SERVER_AWAIT_MS).toBeGreaterThan(JOB_DEADLINE_MS);
  });

  it('EXHAUSTED_FAILURE_CHARGE is a fraction of SUCCESS_CHARGE, per the half-charge policy', () => {
    expect(EXHAUSTED_FAILURE_CHARGE).toBe(SUCCESS_CHARGE / 2);
  });

  it('DETAIL_MAX_EDGE_PX.balanced matches IMG_MAX_EDGE_PX', () => {
    expect(DETAIL_MAX_EDGE_PX.balanced).toBe(IMG_MAX_EDGE_PX);
  });

  it('DETAIL_MAX_EDGE_PX is ordered low < balanced < high', () => {
    expect(DETAIL_MAX_EDGE_PX.low).toBeLessThan(DETAIL_MAX_EDGE_PX.balanced);
    expect(DETAIL_MAX_EDGE_PX.balanced).toBeLessThan(DETAIL_MAX_EDGE_PX.high);
  });
});
