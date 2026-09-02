import { describe, expect, it } from 'vitest';
import { a11yTreeSchema, type A11yNode } from './a11y-tree.schema.js';
import { motionCaptureInputSchema, motionCaptureOutputSchema } from './motion-capture.schema.js';

function leaf(overrides: Partial<A11yNode> = {}): A11yNode {
  return {
    role: 'text',
    inView: true,
    coords: { x: 0, y: 0, w: 10, h: 10 },
    children: [],
    ...overrides,
  };
}

describe('a11yTreeSchema', () => {
  it('accepts a minimal single-node tree', () => {
    const tree = { root: leaf(), truncated: false, nodeCount: 1 };
    expect(a11yTreeSchema.parse(tree)).toEqual(tree);
  });

  it('accepts a below-fold node (inView: false) — annotated, not filtered out', () => {
    const tree = {
      root: leaf({ inView: false, coords: { x: 0, y: 4000, w: 10, h: 10 } }),
      truncated: false,
      nodeCount: 1,
    };
    expect(() => a11yTreeSchema.parse(tree)).not.toThrow();
    expect(a11yTreeSchema.parse(tree).root.inView).toBe(false);
  });

  it('accepts a nested tree with children', () => {
    const tree = {
      root: leaf({ role: 'group', children: [leaf(), leaf({ inView: false })] }),
      truncated: false,
      nodeCount: 3,
    };
    const parsed = a11yTreeSchema.parse(tree);
    expect(parsed.root.children).toHaveLength(2);
  });

  it('carries a truncated flag for size-capped extraction — this is the cap mechanism, not viewport filtering', () => {
    const tree = { root: leaf(), truncated: true, nodeCount: 5000 };
    expect(a11yTreeSchema.parse(tree).truncated).toBe(true);
  });

  it('rejects a node missing required fields', () => {
    expect(() =>
      a11yTreeSchema.parse({ root: { role: 'text' }, truncated: false, nodeCount: 1 }),
    ).toThrow();
  });

  it('rejects a negative nodeCount', () => {
    expect(() => a11yTreeSchema.parse({ root: leaf(), truncated: false, nodeCount: -1 })).toThrow();
  });
});

describe('motionCaptureInputSchema', () => {
  it('defaults to verification mode, time sampling, no fresh bypass', () => {
    const parsed = motionCaptureInputSchema.parse({ url: 'https://example.com' });
    expect(parsed.mode).toBe('verification');
    expect(parsed.scrollSampling).toBe('time');
    expect(parsed.fresh).toBe(false);
  });

  it('accepts an explicit analysis-mode, scroll-scrubbed request', () => {
    const parsed = motionCaptureInputSchema.parse({
      url: 'https://example.com',
      mode: 'analysis',
      scrollSampling: 'scroll-scrubbed',
      fps: 30,
    });
    expect(parsed.mode).toBe('analysis');
    expect(parsed.fps).toBe(30);
  });

  it('rejects an fps above the cap', () => {
    expect(() =>
      motionCaptureInputSchema.parse({ url: 'https://example.com', fps: 120 }),
    ).toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() =>
      motionCaptureInputSchema.parse({ url: 'https://example.com', mode: 'realtime' }),
    ).toThrow();
  });
});

describe('motionCaptureOutputSchema', () => {
  it('accepts a verification-mode contact sheet', () => {
    const output = {
      mode: 'verification' as const,
      contactSheet: {
        b64: 'abc',
        mime: 'image/webp' as const,
        w: 800,
        h: 600,
        bytes: 12345,
        tiles: [{ tMs: 0 }, { tMs: 100, scrollY: 50 }],
      },
    };
    expect(() => motionCaptureOutputSchema.parse(output)).not.toThrow();
  });

  it('accepts an analysis-mode frame list', () => {
    const output = {
      mode: 'analysis' as const,
      frames: [{ tMs: 0, b64: 'x', mime: 'image/webp' as const, w: 100, h: 100 }],
    };
    expect(() => motionCaptureOutputSchema.parse(output)).not.toThrow();
  });

  it('rejects a payload mixing shapes across the mode discriminator', () => {
    expect(() => motionCaptureOutputSchema.parse({ mode: 'verification', frames: [] })).toThrow();
  });
});
