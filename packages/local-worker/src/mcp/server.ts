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
import { Heartbeat } from '../heartbeat/heartbeat.js';
import { loadWorkerId } from '../heartbeat/worker-identity.js';
import { createBearerResolver } from '../auth/bearer.js';
import { TokenProvider } from '../auth/access-token.js';
import { defaultBaseDir } from '../auth/credential-store.js';
import { config } from '../config.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  extractAssetsInputSchema,
  getQuotaInputSchema,
  inspectUiInputSchema,
  motionCaptureInputSchema,
  viewPageInputSchema,
  getTreeInputSchema,
  type GetTreeInput,
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
import { extractA11yTree, extractFullA11yTree } from '../extractors/a11y-tree.js';
import { extractAssets } from '../extractors/assets.js';
import { extractDesignTokens } from '../extractors/design-tokens.js';
import { captureMotion } from '../extractors/motion-capture.js';
import { defaultLocalCache, LocalCache } from '../cache/local-cache.js';

// One version string for the process: the MCP handshake and the heartbeat
// must never disagree about what is running on this machine.
const LOCAL_SERVER_VERSION = '0.1.0';

export interface LocalMcpServerDeps {
  supervisor: SupervisorClient;
  subscriptionValidator?: SubscriptionValidator;
  localCache?: LocalCache;
  /** Injectable so tests never open a socket to the cloud. */
  heartbeat?: Heartbeat;
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
// Built here rather than in heartbeat.ts so that module stays free of the
// credential stack and remains trivially testable with a fake fetch.
async function createDefaultHeartbeat(): Promise<Heartbeat> {
  const resolveBearer = createBearerResolver({
    tokenProvider: new TokenProvider({
      store: { baseDir: defaultBaseDir(), platform: process.platform },
      tokenClient: { clientId: config.authClientId },
    }),
    staticApiKey: config.apiKey,
  });

  return new Heartbeat({
    workerId: await loadWorkerId(),
    version: LOCAL_SERVER_VERSION,
    getToken: async () => {
      const bearer = await resolveBearer();
      if (bearer.kind !== 'ok') {
        // Signed out or offline. Throwing here is caught by Heartbeat.send(),
        // which restores the pending counts and waits for the next tick.
        throw new Error(`no usable credential: ${bearer.kind}`);
      }
      return bearer.token;
    },
  });
}

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
    // Must precede navigate: a viewport applied afterward would leave any
    // width-dependent work the page did on load (media queries resolved at the
    // old size, JS that measured on mount) computed against the wrong size.
    const viewport = args.viewport as { w: number; h: number } | undefined;
    if (viewport) {
      await timePhase(phases, 'viewport', () => page.setViewport(viewport.w, viewport.h));
    }

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

    if (toolName === 'get_tree') {
      // No image, deliberately. This answers a structural question, and a
      // caller reaching for it already has the screenshot -- returning a second
      // copy would spend its budget twice for nothing.
      const input = args as unknown as GetTreeInput;
      const tree = await extractFullA11yTree(page, {
        fromY: input.from_y,
        limit: input.limit,
      });
      return {
        ok: true,
        meta: { requestId: '', rungReached: 0, durationMs: Date.now() - startedAt },
        a11yTree: tree,
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
    // get_tree is local-only for now. The cloud mcp-server has not been given
    // the tool yet, so forwarding would surface as an opaque "unknown tool"
    // from a server the user cannot see. Saying so plainly is better than a
    // protocol error, and it names the workaround.
    if (toolName === 'get_tree') {
      return toCallToolResult(
        failureEnvelope(
          'RENDER_ERROR',
          'get_tree currently works for pages on this machine only. For a page on the open web, ' +
            'view_page returns the visible elements plus an outline of what lies below the fold.',
        ),
      );
    }

    // Cloud captures are metered server-side by the quota system; this count is
    // for the dashboard's local/web split, not for enforcement.
    const result = await forwardToCloud(toolName, args);
    if (!result.isError) {
      deps.heartbeat?.countCapture('cloud');
    }
    return result;
  }

  // Local path — unmetered, but must be subscription-gated (rules-13 §6).
  const validator =
    deps.subscriptionValidator ?? new SubscriptionValidator(createCloudSubscriptionCheck());
  const status = await validator.isActive();
  if (!status.active) {
    // Two very different failures, and they used to print the same sentence.
    // "unreachable" means we never got an answer -- the cloud server is down,
    // unreachable, or not running at the configured address. Reporting that as
    // a subscription problem sends a paying user to their billing page hunting
    // for a fault that is not there.
    return toCallToolResult(
      status.reason === 'unreachable'
        ? failureEnvelope(
            // UPSTREAM_5XX, not a new code: the error set in @ocular/shared is
            // closed by contract and widening it requires updating
            // docs/rules/09 and /03 in the same change. "Our upstream did not
            // answer" is what this is.
            'UPSTREAM_5XX',
            "Couldn't reach Ocular to check this machine's subscription, so capture is paused. " +
              'This is a connection problem, not a billing one — your subscription has not been ' +
              'checked, let alone found wanting.',
          )
        : failureEnvelope(
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

    // Counted here and nowhere else: a real render that actually happened. A
    // cache hit is deliberately NOT counted -- it consumed no browser and no
    // page, and counting it would inflate the number the dashboard shows into
    // something that no longer means "captures Ocular performed for you".
    //
    // The count is an integer and nothing else. There is no branch here that
    // could carry the URL, and there must never be one.
    if (envelope.ok) {
      deps.heartbeat?.countCapture('local');
    }

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
    'get_tree',
    {
      description:
        'Read the full element tree of a page, including everything below the fold. ' +
        'view_page returns the visible part plus an outline of what lies past it; ' +
        'use this when that outline says there is more worth reading.',
      inputSchema: getTreeInputSchema.shape,
    },
    async (args) => handleCaptureTool('get_tree', args, deps),
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
  const mcpServer = new McpServer({ name: 'ocular-local', version: LOCAL_SERVER_VERSION });

  // Built BEFORE registerTools, and threaded through deps, because the capture
  // handlers close over the deps object they are registered with -- creating it
  // afterwards would leave deps.heartbeat undefined at capture time and every
  // count would be silently dropped.
  const heartbeat = deps.heartbeat ?? (await createDefaultHeartbeat());
  registerTools(mcpServer, { ...deps, heartbeat });

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

  // The heartbeat is what makes "connected but idle" a state the dashboard can
  // report honestly. Without it the only signal reaching the cloud is
  // subscription revalidation, which is capture-driven -- so a worker installed
  // on a running machine that nobody has asked to look at anything is silent,
  // and indistinguishable from one that was uninstalled last week.
  //
  // Started AFTER warm and never awaited: a failed heartbeat must never delay
  // or block a capture, and the timer is unref'd so it cannot hold the process
  // open past the lifecycle manager's decision to shut down.
  heartbeat.start();

  return {
    close: async () => {
      heartbeat.stop();
      await mcpServer.close();
    },
  };
}
