import { describe, expect, it } from 'vitest';
import { toCallToolResult } from './server.js';
import type { A11yNode, ResultEnvelope } from '@ocular/shared';

function leaf(): A11yNode {
  return { role: 'text', inView: true, coords: { x: 0, y: 0, w: 1, h: 1 }, children: [] };
}

// Regression coverage for a real bug found while wiring the a11y tree
// through this file: an earlier version stuffed `envelope.image.b64` into a
// JSON text blob via a naive `data ?? envelope` fallback instead of a
// proper MCP `image` content block. Mirrors
// packages/mcp-server/src/mcp/to-content-blocks.test.ts's cases so both
// paths are held to the same contract.
describe('toCallToolResult (local-worker)', () => {
  it('returns just the failure message for a failure envelope', () => {
    const envelope: ResultEnvelope = {
      ok: false,
      reason: 'RENDER_ERROR',
      message: 'boom',
      rungReached: 0,
    };
    expect(toCallToolResult(envelope)).toEqual({
      content: [{ type: 'text', text: 'boom' }],
      isError: true,
    });
  });

  it('produces a real MCP image block for a screenshot, not a JSON-stringified envelope', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      image: { b64: 'abc', mime: 'image/webp', w: 10, h: 10, bytes: 100 },
    };
    const result = toCallToolResult(envelope);
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([{ type: 'image', data: 'abc', mimeType: 'image/webp' }]);
  });

  it('produces image + a11yTree blocks together for view_page', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      image: { b64: 'abc', mime: 'image/webp', w: 10, h: 10, bytes: 100 },
      a11yTree: { root: leaf(), truncated: false, nodeCount: 1 },
    };
    const result = toCallToolResult(envelope);
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({ type: 'image', data: 'abc', mimeType: 'image/webp' });
  });

  it('produces a data text block for inspect_ui/extract_assets shapes', () => {
    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      data: { svgs: [], imageUrls: [] },
    };
    expect(toCallToolResult(envelope).content).toEqual([
      { type: 'text', text: JSON.stringify({ svgs: [], imageUrls: [] }) },
    ]);
  });
});
