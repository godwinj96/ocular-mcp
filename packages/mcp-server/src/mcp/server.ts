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
  DAILY_CLOUD_QUOTA_BY_TIER,
  extractAssetsInputSchema,
  getQuotaInputSchema,
  inspectUiInputSchema,
  motionCaptureInputSchema,
  tierOfPlanSlug,
  viewPageInputSchema,
} from '@ocular/shared';
import type { FailureEnvelope, ResultEnvelope, ToolName } from '@ocular/shared';
import { resolveAccount } from '../auth/resolve-account.js';
import { config as appConfig } from '../config.js';
import { getCachedEnvelope } from '../cache/redis-cache.js';
import { checkAndReserveQuota } from '../quota/redis-quota.js';
import { checkAndRecordRateLimit } from '../rate-limit/redis-rate-limiter.js';
import { precheckUrl } from '../ssrf/precheck.js';
import { handleExtractAssets } from '../tools/extract-assets.js';
import { handleGetQuota } from '../tools/get-quota.js';
import { handleInspectUi } from '../tools/inspect-ui.js';
import { handleMotionCapture } from '../tools/motion-capture.js';
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

interface CacheOptions {
  tool: ToolName;
  args: Record<string, unknown>;
  /** From the tool's own `fresh` input field — bypasses the cache read, never the write. */
  fresh: boolean;
}

interface PipelineOptions {
  url?: string;
  requiresQuota: boolean;
  /** Present only for cacheable render tools — get_quota never sets this. */
  cache?: CacheOptions;
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

  // Per-account rate limit, independent of monthly quota (docs/rules/07-security.md
  // §4) — the backstop for the half-charge-on-failure billing policy. Applies to
  // every tool call, not just render tools: get_quota is cheap per-call but still
  // a Redis round-trip an account could otherwise hammer without limit.
  const rateLimit = await checkAndRecordRateLimit(account.accountId);
  if (!rateLimit.allowed) {
    return toCallToolResult(
      failureEnvelope('RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.'),
    );
  }

  if (opts.url !== undefined) {
    const precheck = await precheckUrl(opts.url);
    if (precheck.blocked) {
      return toCallToolResult(
        failureEnvelope(precheck.reason ?? 'SSRF_BLOCKED', 'The requested URL is not allowed.'),
      );
    }
  }

  // Cache check — after SSRF precheck (a hit never navigates anywhere, so
  // no re-check needed) but before quota reserve: a hit is free and never
  // touches quota at all, not reserve-then-refund (docs/rules/11-billing-and-quota.md
  // §9's cache-hit-is-free decision). `fresh: true` bypasses the read only —
  // the render that follows still writes a fresh cache entry (in worker).
  if (opts.cache && !opts.cache.fresh) {
    const cached = await getCachedEnvelope(opts.cache.tool, opts.cache.args);
    if (cached) {
      return toCallToolResult(cached);
    }
  }

  if (opts.requiresQuota) {
    // verify-jwt/verify-static-key already reject any account without an
    // active subscription (see auth/), so tierOfPlanSlug should never return
    // null here — the 'basic' fallback only guards against an unrecognized
    // plan slug reaching this far, not against no plan at all.
    const tier = tierOfPlanSlug(account.plan) ?? 'basic';
    const quota = await checkAndReserveQuota(account.accountId, DAILY_CLOUD_QUOTA_BY_TIER[tier]);
    if (!quota.allowed) {
      return toCallToolResult(failureEnvelope('QUOTA_EXCEEDED', 'Daily cloud quota exceeded.'));
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
    {
      description: 'Render a page and return a screenshot.',
      inputSchema: viewPageInputSchema.shape,
    },
    async (args, extra) =>
      runToolPipeline(
        extra,
        {
          url: args.url,
          requiresQuota: true,
          cache: { tool: 'view_page', args, fresh: args.fresh },
        },
        (ctx) => handleViewPage(args, ctx),
      ),
  );

  mcpServer.registerTool(
    'inspect_ui',
    {
      description: 'Extract design tokens and UI structure from a page.',
      inputSchema: inspectUiInputSchema.shape,
    },
    async (args, extra) =>
      runToolPipeline(
        extra,
        {
          url: args.url,
          requiresQuota: true,
          cache: { tool: 'inspect_ui', args, fresh: args.fresh },
        },
        (ctx) => handleInspectUi(args, ctx),
      ),
  );

  mcpServer.registerTool(
    'extract_assets',
    {
      description: 'Extract SVG, image, and icon assets from a page.',
      inputSchema: extractAssetsInputSchema.shape,
    },
    async (args, extra) =>
      runToolPipeline(
        extra,
        {
          url: args.url,
          requiresQuota: true,
          cache: { tool: 'extract_assets', args, fresh: args.fresh },
        },
        (ctx) => handleExtractAssets(args, ctx),
      ),
  );

  mcpServer.registerTool(
    'motion_capture',
    {
      description: 'Capture discrete stills of an animation for motion verification.',
      inputSchema: motionCaptureInputSchema.shape,
    },
    async (args, extra) =>
      runToolPipeline(
        extra,
        {
          url: args.url,
          requiresQuota: true,
          cache: { tool: 'motion_capture', args, fresh: args.fresh },
        },
        (ctx) => handleMotionCapture(args, ctx),
      ),
  );

  mcpServer.registerTool(
    'get_quota',
    {
      description: 'Get remaining monthly quota and the next reset date.',
      inputSchema: getQuotaInputSchema.shape,
    },
    async (args, extra) =>
      runToolPipeline(extra, { requiresQuota: false }, (ctx) => handleGetQuota(args, ctx)),
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
    // Origin/CORS guard — see docs/rules/04-mcp-server-and-auth.md §5 and
    // config.ts's allowedOrigins comment. No @fastify/cors plugin is
    // registered (so no Access-Control-Allow-Origin is ever emitted — this
    // is never a browser-embeddable API), and this rejects outright any
    // request that does carry an Origin header not on the explicit
    // allowlist, closing the DNS-rebinding vector the MCP spec's Streamable
    // HTTP transport guidance calls out. Real MCP clients (stdio bridges,
    // server-to-server calls) never send Origin at all, so this never
    // affects them.
    const origin = request.headers.origin;
    if (origin && !appConfig.allowedOrigins.includes(origin)) {
      reply.code(403).send({ error: 'origin_not_allowed' });
      return;
    }

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
