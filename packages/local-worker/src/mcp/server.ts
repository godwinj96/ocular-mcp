// Local stdio MCP server. See docs/rules/13-local-worker-and-distribution.md
// §2: Agent -> stdio MCP -> this file -> loopback IPC -> supervisor.
//
// Registers the same tool surface as the cloud mcp-server. Per tool call:
//   1. Zod-validate args (shared schema).
//   2. routeTarget() decides local vs. cloud vs. blocked.
//   3. cloud -> forward to the deployed mcp-server as an HTTP MCP client.
//   4. local -> check subscription validity, check the local cache (unless
//      fresh:true — the cache check happens before the browser is ever
//      touched), then render via CDP (view_page/inspect_ui/extract_assets/
//      motion_capture are all real as of Phase 5/6).
//
// Unlike the cloud mcp-server (fresh McpServer+transport per HTTP request,
// stateless-by-design), stdio is inherently one long-lived connection per
// process — this server registers tools once, at startup.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  extractAssetsInputSchema,
  getQuotaInputSchema,
  inspectUiInputSchema,
  motionCaptureInputSchema,
  viewPageInputSchema,
  JOB_DEADLINE_MS,
} from '@ocular/shared';
import type {
  ExtractAssetsInput,
  FailureEnvelope,
  MotionCaptureInput,
  ResultEnvelope,
  ToolName,
  ViewPageInput,
} from '@ocular/shared';
import { routeTarget } from '../routing/route-target.js';
import { connectCloudClient } from '../http/cloud-client.js';
import { SubscriptionValidator, createCloudSubscriptionCheck } from '../subscription/validate.js';
import type { SupervisorClient } from '../supervisor/client.js';
import { getBrowserSession } from '../browser/session.js';
import { encodeScreenshot } from '../image/pipeline.js';
import { extractA11yTree } from '../extractors/a11y-tree.js';
import { extractAssets } from '../extractors/assets.js';
import { extractDesignTokens } from '../extractors/design-tokens.js';
import { captureMotion } from '../extractors/motion-capture.js';
import { defaultLocalCache, LocalCache } from '../cache/local-cache.js';

export interface LocalMcpServerDeps {
  supervisor: SupervisorClient;
  subscriptionValidator?: SubscriptionValidator;
  localCache?: LocalCache;
}

function failureEnvelope(reason: FailureEnvelope['reason'], message: string): FailureEnvelope {
  return { ok: false, reason, message, rungReached: 0 };
}

// Mirrors packages/mcp-server/src/mcp/to-content-blocks.ts's mapping —
// deliberately duplicated (local-worker doesn't depend on mcp-server as a
// package; only @ocular/shared crosses the boundary). A prior version of
// this function stuffed `envelope.image.b64` into a JSON text blob via a
// naive `data ?? envelope` fallback instead of a proper MCP `image` content
// block — found and fixed while wiring the a11y tree through here, since
// that fallback would have swallowed the tree the same way.
export function toCallToolResult(envelope: ResultEnvelope): CallToolResult {
  if (!envelope.ok) {
    return { content: [{ type: 'text', text: envelope.message }], isError: true };
  }

  const content: CallToolResult['content'] = [];
  if (envelope.image) {
    content.push({ type: 'image', data: envelope.image.b64, mimeType: envelope.image.mime });
  }
  if (envelope.data !== undefined) {
    content.push({ type: 'text', text: JSON.stringify(envelope.data) });
  }
  if (envelope.a11yTree !== undefined) {
    content.push({ type: 'text', text: JSON.stringify({ a11yTree: envelope.a11yTree }) });
  }
  return { content, isError: false };
}

// Cloud-routed calls forward verbatim — the cloud mcp-server's own pipeline
// (auth, SSRF, quota) is the authority there; this is a pass-through client,
// not a second enforcement layer.
async function forwardToCloud(
  tool: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  let client;
  try {
    client = await connectCloudClient();
  } catch (error) {
    return toCallToolResult(
      failureEnvelope(
        'RENDER_ERROR',
        `Could not reach the cloud path: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  try {
    return await client.callTool(tool, args);
  } finally {
    await client.close().catch(() => undefined);
  }
}

// Phase timing for the local render path. Emitted to stderr (never stdout —
// that carries the MCP JSON-RPC framing) and only when OCULAR_TRACE_PHASES is
// set, so normal runs pay nothing. Exists because `meta.durationMs` was a
// single opaque number: knowing a capture took 11s doesn't say whether the
// cost is navigation, paint, the a11y walk, or the encode, and those point at
// completely different fixes. See docs/dogfooding/.
async function timePhase<T>(phases: Record<string, number>, name: string, fn: () => Promise<T>) {
  const t = Date.now();
  try {
    return await fn();
  } finally {
    phases[name] = Date.now() - t;
  }
}

function tracePhases(url: string, phases: Record<string, number>, totalMs: number): void {
  if (!process.env.OCULAR_TRACE_PHASES) return;
  process.stderr.write(JSON.stringify({ ocularPhaseTrace: { url, totalMs, phases } }) + '\n');
}

async function renderLocally(
  toolName: string,
  args: { url: string; [key: string]: unknown },
  cdpUrl: string,
): Promise<ResultEnvelope> {
  const phases: Record<string, number> = {};
  const startedAt = Date.now();
  const browser = await timePhase(phases, 'session', () => getBrowserSession(cdpUrl));
  const page = await timePhase(phases, 'newPage', () => browser.newPage());

  try {
    await timePhase(phases, 'navigate', () => page.navigate(args.url, JOB_DEADLINE_MS));

    if (toolName === 'view_page') {
      const input = args as unknown as ViewPageInput;
      const raw = await timePhase(phases, 'screenshot', () =>
        page.screenshot({ fullPage: input.full_page }),
      );
      // encode and a11y extraction run concurrently, so their phase times
      // overlap and must not be read as additive against the total.
      const [encoded, a11yTree] = await Promise.all([
        timePhase(phases, 'encode', () => encodeScreenshot(raw, input.detail)),
        // See packages/worker/src/worker.ts's identical comment — shipped
        // unconditionally alongside every screenshot on both paths.
        timePhase(phases, 'a11yTree', () => extractA11yTree(page).catch(() => undefined)),
      ]);
      const durationMs = Date.now() - startedAt;
      tracePhases(args.url, phases, durationMs);
      return {
        ok: true,
        meta: { requestId: '', rungReached: 0, durationMs },
        image: {
          b64: encoded.b64,
          mime: encoded.mime,
          w: encoded.w,
          h: encoded.h,
          bytes: encoded.bytes,
        },
        a11yTree,
      };
    }

    if (toolName === 'inspect_ui') {
      const tokens = await extractDesignTokens(page);
      return { ok: true, meta: { requestId: '', rungReached: 0, durationMs: 0 }, data: tokens };
    }

    if (toolName === 'extract_assets') {
      const input = args as unknown as ExtractAssetsInput;
      const assets = await extractAssets(page, input.include);
      return { ok: true, meta: { requestId: '', rungReached: 0, durationMs: 0 }, data: assets };
    }

    if (toolName === 'motion_capture') {
      const input = args as unknown as MotionCaptureInput;
      const output = await captureMotion(page, input);
      // Sequential, not concurrent with captureMotion above — mirrors
      // packages/worker/src/worker.ts's identical comment: motion capture
      // actively scrolls/samples the page, so reading the a11y tree at the
      // same time would race the extractor's own wheel-scroll calls.
      const a11yTree = await extractA11yTree(page).catch(() => undefined);
      return {
        ok: true,
        meta: { requestId: '', rungReached: 0, durationMs: 0 },
        data: output,
        a11yTree,
      };
    }

    return failureEnvelope('RENDER_ERROR', `Unsupported tool: ${toolName}`);
  } catch (error) {
    return failureEnvelope(
      'RENDER_ERROR',
      error instanceof Error ? error.message : 'Local capture failed.',
    );
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function handleCaptureTool(
  toolName: string,
  args: { url: string; [key: string]: unknown },
  deps: LocalMcpServerDeps,
): Promise<CallToolResult> {
  const decision = await routeTarget(args.url);

  if (decision.route === 'blocked') {
    return toCallToolResult(failureEnvelope(decision.reason, 'The requested URL is not allowed.'));
  }

  if (decision.route === 'cloud') {
    return forwardToCloud(toolName, args);
  }

  // Local path — unmetered, but must be subscription-gated (rules-13 §6).
  const validator =
    deps.subscriptionValidator ?? new SubscriptionValidator(createCloudSubscriptionCheck());
  const status = await validator.isActive();
  if (!status.active) {
    return toCallToolResult(
      failureEnvelope(
        'UNAUTHORIZED',
        'No active Ocular subscription — local rendering requires one.',
      ),
    );
  }

  // Cache check happens BEFORE the browser is ever touched (capture_start
  // included) — a hit costs nothing beyond a filesystem read, not even a
  // lifecycle transition. `fresh` bypasses the read only; a fresh render
  // still writes a new entry below. docs/rules/13-local-worker-and-distribution.md
  // §7's local-cache contract, mirroring the cloud path's cache-hit-is-free
  // shape even though local renders were already unmetered either way.
  const localCache = deps.localCache ?? defaultLocalCache;
  const wantsFresh = Boolean((args as { fresh?: boolean }).fresh);
  if (!wantsFresh) {
    const cached = await localCache.get(toolName as ToolName, args);
    if (cached) {
      return toCallToolResult(cached);
    }
  }

  const captureStart = await deps.supervisor.send('capture_start');
  try {
    if (!captureStart.ok || !captureStart.cdpUrl) {
      return toCallToolResult(
        failureEnvelope('RENDER_ERROR', captureStart.error ?? 'Local browser failed to warm.'),
      );
    }
    const envelope = await renderLocally(toolName, args, captureStart.cdpUrl);
    await localCache.set(toolName as ToolName, args, envelope).catch(() => undefined);
    return toCallToolResult(envelope);
  } finally {
    await deps.supervisor.send('capture_end');
  }
}

function registerTools(mcpServer: McpServer, deps: LocalMcpServerDeps): void {
  mcpServer.registerTool(
    'view_page',
    {
      description: 'Render a page and return a screenshot.',
      inputSchema: viewPageInputSchema.shape,
    },
    async (args) => handleCaptureTool('view_page', args, deps),
  );

  mcpServer.registerTool(
    'inspect_ui',
    {
      description: 'Extract design tokens and UI structure from a page.',
      inputSchema: inspectUiInputSchema.shape,
    },
    async (args) => handleCaptureTool('inspect_ui', args, deps),
  );

  mcpServer.registerTool(
    'extract_assets',
    {
      description: 'Extract SVG, image, and icon assets from a page.',
      inputSchema: extractAssetsInputSchema.shape,
    },
    async (args) => handleCaptureTool('extract_assets', args, deps),
  );

  mcpServer.registerTool(
    'motion_capture',
    {
      description: 'Capture discrete stills of an animation for motion verification.',
      inputSchema: motionCaptureInputSchema.shape,
    },
    async (args) => handleCaptureTool('motion_capture', args, deps),
  );

  // get_quota is inherently cloud-scoped (it reports the daily cloud cap,
  // never local usage — see mcp-server/src/tools/get-quota.ts's own
  // comment) — always forwarded, never routed through routeTarget.
  mcpServer.registerTool(
    'get_quota',
    {
      description: 'Get remaining cloud-render quota and reset time.',
      inputSchema: getQuotaInputSchema.shape,
    },
    async (args) => forwardToCloud('get_quota', args),
  );
}

export async function startLocalMcpServer(
  deps: LocalMcpServerDeps,
): Promise<{ close(): Promise<void> }> {
  const mcpServer = new McpServer({ name: 'ocular-local', version: '0.1.0' });
  registerTools(mcpServer, deps);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  // Approximation of "warm on MCP initialize" (rules-13 §3): for stdio, the
  // agent spawns this process fresh per session, so process startup and
  // session start are effectively the same moment — there is no separate
  // long-lived server process serving multiple sessions the way the cloud
  // HTTP server does. Warming here rather than hooking the SDK's internal
  // initialize event is a deliberate simplification for Phase 2; revisit if
  // stdio session reuse across multiple agent connections ever becomes real.
  await deps.supervisor.send('warm');

  return {
    close: async () => {
      await mcpServer.close();
    },
  };
}
