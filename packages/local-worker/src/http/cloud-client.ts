// Thin MCP client wrapper for forwarding cloud-routed tool calls to the
// deployed mcp-server, and for the subscription-validity check (see
// ../subscription/validate.ts). Same Client/StreamableHTTPClientTransport
// pattern already proven in packages/mcp-server/src/mcp/server.test.ts's
// end-to-end suite — this is that pattern used as a real runtime client,
// not just a test harness.
//
// Auth: the cloud mcp-server's Bearer auth accepts a static API key
// (docs/rules/11-billing-and-quota.md §4) — see config.ts's note on the
// Phase 8 install-time credential flow this currently stands in for.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { config } from '../config.js';

export interface CloudClient {
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  close(): Promise<void>;
}

export class NoApiKeyError extends Error {
  constructor() {
    super('OCULAR_API_KEY is not configured — cannot forward to the cloud path.');
    this.name = 'NoApiKeyError';
  }
}

export async function connectCloudClient(): Promise<CloudClient> {
  if (!config.apiKey) {
    throw new NoApiKeyError();
  }

  const transport = new StreamableHTTPClientTransport(new URL(config.cloudMcpUrl), {
    requestInit: { headers: { authorization: `Bearer ${config.apiKey}` } },
  });
  const client = new Client({ name: 'ocular-local-worker', version: '0.1.0' });
  await client.connect(transport);

  return {
    callTool: (name, args) => client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
    close: () => client.close(),
  };
}
