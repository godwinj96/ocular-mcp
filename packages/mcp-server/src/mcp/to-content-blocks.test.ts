import { describe, expect, it } from 'vitest';
import { toContentBlocks } from './to-content-blocks.js';
import type { A11yNode } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';

function leaf(): A11yNode {
  return { role: 'text', inView: true, coords: { x: 0, y: 0, w: 1, h: 1 }, children: [] };
}

describe('toContentBlocks', () => {
  it('returns just the failure message for a failure envelope', () => {
    const envelope: ResultEnvelope = {
      ok: false,
      reason: 'RENDER_ERROR',
      message: 'boom',
      rungReached: 1,
    };
    expect(toContentBlocks(envelope)).toEqual([{ type: 'text', text: 'boom' }]);
  });

  it('produces an image block for a screenshot, with no other blocks when nothing else is present', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      image: { b64: 'abc', mime: 'image/webp', w: 10, h: 10, bytes: 100 },
    };
    expect(toContentBlocks(envelope)).toEqual([
      { type: 'image', data: 'abc', mimeType: 'image/webp' },
    ]);
  });

  it('produces a text block for tool data (inspect_ui/extract_assets shape)', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      data: { palette: ['red'] },
    };
    expect(toContentBlocks(envelope)).toEqual([
      { type: 'text', text: JSON.stringify({ palette: ['red'] }) },
    ]);
  });

  it('produces image + a11yTree blocks together for view_page — the a11y tree ships alongside the screenshot, never replacing it', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      image: { b64: 'abc', mime: 'image/webp', w: 10, h: 10, bytes: 100 },
      a11yTree: { root: leaf(), truncated: false, nodeCount: 1 },
    };
    const blocks = toContentBlocks(envelope);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'image', data: 'abc', mimeType: 'image/webp' });
    expect(blocks[1]).toEqual({
      type: 'text',
      text: JSON.stringify({ a11yTree: { root: leaf(), truncated: false, nodeCount: 1 } }),
    });
  });

  it('never omits the a11yTree block even when the tree is empty/degenerate (extraction failed but envelope still succeeded)', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      a11yTree: { root: leaf(), truncated: true, nodeCount: 1500 },
    };
    const blocks = toContentBlocks(envelope);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
  });
});
