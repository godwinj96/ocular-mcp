// ResultEnvelope -> MCP content blocks. See docs/rules/04-mcp-server-and-auth.md §4.
// Rule: never leak internal envelope fields (rungReached, meta.durationMs, etc.)
// into user-facing MCP error messages beyond what's explicitly useful to the agent.

import type { ResultEnvelope } from '@ocular/shared';

export type McpContentBlock =
  | { type: 'image'; data: string; mimeType: 'image/webp' }
  | { type: 'text'; text: string };

export function toContentBlocks(envelope: ResultEnvelope): McpContentBlock[] {
  if (!envelope.ok) {
    // The CallToolResult-level `isError: true` flag (set by the caller in
    // mcp/server.ts, alongside this content) is what actually marks this as
    // an MCP tool error — this function only ever produces content blocks.
    return [{ type: 'text', text: envelope.message }];
  }

  const blocks: McpContentBlock[] = [];
  if (envelope.image) {
    blocks.push({ type: 'image', data: envelope.image.b64, mimeType: envelope.image.mime });
  }
  if (envelope.data !== undefined) {
    blocks.push({ type: 'text', text: JSON.stringify(envelope.data) });
  }
  return blocks;
}
