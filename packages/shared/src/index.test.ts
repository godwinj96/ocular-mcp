import { describe, expect, it } from 'vitest';
import * as ocularShared from './index.js';

describe('@ocular/shared public surface', () => {
  it('re-exports the error code schema and result envelope helpers', () => {
    expect(ocularShared.errorCodeSchema).toBeDefined();
  });

  it('re-exports all five tool input schemas', () => {
    expect(ocularShared.viewPageInputSchema).toBeDefined();
    expect(ocularShared.inspectUiInputSchema).toBeDefined();
    expect(ocularShared.extractAssetsInputSchema).toBeDefined();
    expect(ocularShared.getQuotaInputSchema).toBeDefined();
    expect(ocularShared.motionCaptureInputSchema).toBeDefined();
  });

  it('re-exports the a11y-tree schema (shipped alongside every screenshot, both paths)', () => {
    expect(ocularShared.a11yTreeSchema).toBeDefined();
    expect(ocularShared.a11yNodeSchema).toBeDefined();
  });

  it('re-exports the starting configuration constants', () => {
    expect(ocularShared.JOB_DEADLINE_MS).toBeTypeOf('number');
  });
});
