// Streamable HTTP MCP transport setup, on Fastify. See docs/rules/04-mcp-server-and-auth.md §5.
// Do not introduce Express or a second HTTP framework.
//
// Wires the per-request pipeline from docs/rules/04-mcp-server-and-auth.md §3:
// resolve-account -> (SDK does the Zod arg validation) -> ssrf precheck ->
// quota -> handler (which enqueues + awaits, or for get_quota, reads
// directly) -> to-content-blocks. Every rejection before the handler runs
// returns a FailureEnvelope mapped straight to an MCP tool error — it never
// enqueues a job or touches quota beyond the read in the quota-check step,
// per that same section's closing rule.

import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  extractAssetsInputSchema,
  getQuotaInputSchema,
  inspectUiInputSchema,
  viewPageInputSchema,
} from '@ocular/shared';
import type { FailureEnvelope, ResultEnvelope } from '@ocular/shared';
import { resolveAccount } from '../auth/resolve-account.js';
import { checkAndReserveQuota } from '../quota/redis-quota.js';
import { precheckUrl } from '../ssrf/precheck.js';
import { handleExtractAssets } from '../tools/extract-assets.js';
import { handleGetQuota } from '../tools/get-quota.js';
import { handleInspectUi } from '../tools/inspect-ui.js';
import { handleViewPage } from '../tools/view-page.js';
import type { ToolRequestContext } from '../tools/view-page.js';
import { toContentBlocks } from './to-content-blocks.js';

export interface McpServerConfig {
  port: number;
}

export interface McpServerHandle {
  /** Actual bound port — same as config.port unless config.port was 0 (test convenience). */
  port: number;
  close: () => Promise<void>;
}

// Minimal structural slice of the SDK's RequestHandlerExtra — only what this
// pipeline actually reads (the Authorization header off the original HTTP
// request). Avoids importing the SDK's full generic RequestHandlerExtra type
// just to name one field.
interface RequestHeaderSource {
  requestInfo?: { headers: Record<string, string | string[] | undefined> };
}

interface PipelineOptions {
  url?: string;
  requiresQuota: boolean;
}

function failureEnvelope(reason: FailureEnvelope['reason'], message: string): FailureEnvelope {
  return { ok: false, reason, message, rungReached: 0 };
}

function toCallToolResult(envelope: ResultEnvelope): CallToolResult {
  return { content: toContentBlocks(envelope), isError: !envelope.ok };
}

function bearerHeader(extra: RequestHeaderSource): string | undefined {
  const value = extra.requestInfo?.headers.authorization;
  return Array.isArray(value) ? value[0] : value;
}

// Shared per-tool-call pipeline: auth -> SSRF precheck (URL-taking tools
// only) -> quota reserve (render tools only) -> the tool's own handler.
async function runToolPipeline(
  extra: RequestHeaderSource,
  opts: PipelineOptions,
  run: (ctx: ToolRequestContext) => Promise<ResultEnvelope>,
): Promise<CallToolResult> {
  let account;
  try {
    account = await resolveAccount(bearerHeader(extra));
  } catch {
    return toCallToolResult(failureEnvelope('UNAUTHORIZED', 'Authentication failed.'));
  }

  if (opts.url !== undefined) {
    const precheck = await precheckUrl(opts.url);
    if (precheck.blocked) {
      return toCallToolResult(
        failureEnvelope(precheck.reason ?? 'SSRF_BLOCKED', 'The requested URL is not allowed.'),
      );
    }
  }

  if (opts.requiresQuota) {
    const quota = await checkAndReserveQuota(account.accountId);
    if (!quota.allowed) {
      return toCallToolResult(failureEnvelope('QUOTA_EXCEEDED', 'Monthly quota exceeded.'));
    }
  }

  const ctx: ToolRequestContext = {
    account: { id: account.accountId, plan: account.plan },
    requestId: randomUUID(),
  };
  const envelope = await run(ctx);
  return toCallToolResult(envelope);
}

function registerTools(mcpServer: McpServer): void {
  mcpServer.registerTool(
    'view_page',
    { description: 'Render a page and return a screenshot.', inputSchema: viewPageInputSchema.shape },
    async (args, extra) => runToolPipeline(extra, { url: args.url, requiresQuota: true }, (ctx) => handleViewPage(args, ctx)),
  );

  mcpServer.registerTool(
    'inspect_ui',
    {
      description: 'Extract design tokens and UI structure from a page.',
      inputSchema: inspectUiInputSchema.shape,
    },
    async (args, extra) => runToolPipeline(extra, { url: args.url, requiresQuota: true }, (ctx) => handleInspectUi(args, ctx)),
  );

  mcpServer.registerTool(
    'extract_assets',
    {
      description: 'Extract SVG, image, and icon assets from a page.',
      inputSchema: extractAssetsInputSchema.shape,
    },
    async (args, extra) =>
      runToolPipeline(extra, { url: args.url, requiresQuota: true }, (ctx) => handleExtractAssets(args, ctx)),
  );

  mcpServer.registerTool(
    'get_quota',
    { description: 'Get remaining monthly quota and the next reset date.', inputSchema: getQuotaInputSchema.shape },
    async (args, extra) => runToolPipeline(extra, { requiresQuota: false }, (ctx) => handleGetQuota(args, ctx)),
  );
}

export async function startMcpServer(config: McpServerConfig): Promise<McpServerHandle> {
  const fastify = Fastify({ logger: true });

  // The transport reads the raw Node request stream itself to build its own
  // Web-standard Request internally — if Fastify's default JSON parser also
  // consumes that stream to populate `request.body` first, the transport's
  // own read gets an already-ended stream and every POST fails. Registering
  // a no-op parser leaves the stream untouched for the transport to read.
  fastify.addContentTypeParser('application/json', (_request, _payload, done) => {
    done(null, undefined);
  });

  // The transport speaks directly to Node's raw IncomingMessage/ServerResponse
  // (it writes the SSE/JSON response itself), so this route hands off to it
  // via Fastify's `reply.hijack()` instead of returning a value for Fastify
  // to serialize.
  //
  // Stateless mode (docs/rules/04-mcp-server-and-auth.md §0.4: "Stateless
  // service" — no session ID, no sticky routing) requires a *fresh*
  // McpServer + transport pair per request, not one shared long-lived pair:
  // StreamableHTTPServerTransport throws "Stateless transport cannot be
  // reused across requests" on a second call otherwise. Registering the four
  // tools is pure closure setup (no I/O), so doing it per request is cheap.
  fastify.all('/mcp', async (request, reply) => {
    reply.hijack();
    const mcpServer = new McpServer({ name: 'ocular', version: '0.1.0' });
    registerTools(mcpServer);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    reply.raw.on('close', () => {
      transport.close().catch(() => undefined);
      mcpServer.close().catch(() => undefined);
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(request.raw, reply.raw);
    } catch {
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'content-type': 'application/json' });
        reply.raw.end(JSON.stringify({ error: 'internal_error' }));
      }
    }
  });

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  const address = fastify.server.address();
  const boundPort = address !== null && typeof address === 'object' ? address.port : config.port;

  return {
    port: boundPort,
    close: async () => {
      await fastify.close();
    },
  };
}
