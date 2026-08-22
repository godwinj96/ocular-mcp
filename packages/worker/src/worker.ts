// BullMQ Worker + render semaphore + recycle. See
// docs/rules/05-worker-and-browser-pipeline.md §1 for the full per-job lifecycle
// (acquire semaphore -> SSRF check -> routing memory -> stealth ladder ->
// extractor -> image pipeline -> envelope, always closing the context in `finally`).

import { Worker } from 'bullmq';
import {
  BROWSER_RECYCLE_MINUTES,
  BROWSER_RECYCLE_REQUESTS,
  QUEUE_CONCURRENCY,
  RENDER_CONCURRENCY,
  RENDER_QUEUE_NAME,
} from '@ocular/shared';
import type { ExtractAssetsInput, OcularJob, ResultEnvelope, ViewPageInput } from '@ocular/shared';
import { config } from './config.js';
import { extractAssets } from './extractors/assets.js';
import { extractDesignTokens } from './extractors/design-tokens.js';
import { extractScreenshot } from './extractors/screenshot.js';
import { encodeScreenshot } from './image/pipeline.js';
import { runStealthLadder } from './ladder/stealth-ladder.js';
import type { SelfHostedProvider } from './providers/self-hosted-provider.js';
import { defaultQuotaSettler } from './quota/settle-quota.js';
import { authoritativeSsrfCheck } from './ssrf/authoritative-check.js';

export interface WorkerHandle {
  stop(): Promise<void>;
}

// Counting semaphore gating render work at RENDER_CONCURRENCY, independent
// of BullMQ's own QUEUE_CONCURRENCY — queue depth can run ahead of actual
// render capacity (docs/rules/05-worker-and-browser-pipeline.md §1).
class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(capacity: number) {
    this.available = capacity;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.available += 1;
    }
  }
}

// BullMQ bundles its own private copy of ioredis — see the identical note in
// mcp-server/src/queue/enqueue.ts for why a plain options object, not a live
// client instance, is passed here.
function toConnectionOptions(connectionUrl: string) {
  const parsed = new URL(connectionUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function failure(
  reason: Exclude<ResultEnvelope, { ok: true }>['reason'],
  message: string,
  rungReached = 0,
): ResultEnvelope {
  return { ok: false, reason, message, rungReached };
}

async function processJob(provider: SelfHostedProvider, job: OcularJob): Promise<ResultEnvelope> {
  const startedAt = Date.now();

  if (job.tool === 'get_quota') {
    // get_quota is answered directly by mcp-server (read-only Redis+Postgres
    // peek) and never enqueued — see docs/rules/04-mcp-server-and-auth.md §3.
    // A job reaching here for this tool indicates a producer bug, not a
    // render failure.
    return failure('RENDER_ERROR', 'get_quota should never be queued.');
  }

  const args = job.args as { url: string };

  const ssrfResult = await authoritativeSsrfCheck(args.url);
  if (ssrfResult.blocked) {
    return failure('SSRF_BLOCKED', 'The requested URL is not allowed.');
  }

  let ladderResult;
  try {
    ladderResult = await runStealthLadder(provider, args.url, job.deadlineMs);
  } catch {
    return failure('RENDER_ERROR', 'Rendering failed.');
  }

  if (ladderResult.verdict === 'EXHAUSTED') {
    return failure(
      'BLOCKED',
      'The page could not be rendered after exhausting the stealth ladder.',
      ladderResult.rungReached,
    );
  }

  const { page, context, rungReached } = ladderResult;

  try {
    if (job.tool === 'view_page') {
      const input = job.args as ViewPageInput;
      const raw = await extractScreenshot(page, { fullPage: input.full_page });
      const encoded = await encodeScreenshot(raw, input.detail);
      return {
        ok: true,
        meta: { requestId: job.requestId, rungReached, durationMs: Date.now() - startedAt },
        image: {
          b64: encoded.b64,
          mime: encoded.mime,
          w: encoded.w,
          h: encoded.h,
          bytes: encoded.bytes,
        },
      };
    }

    if (job.tool === 'inspect_ui') {
      const tokens = await extractDesignTokens(page);
      return {
        ok: true,
        meta: { requestId: job.requestId, rungReached, durationMs: Date.now() - startedAt },
        data: tokens,
      };
    }

    if (job.tool === 'extract_assets') {
      const input = job.args as ExtractAssetsInput;
      const assets = await extractAssets(page, input.include);
      return {
        ok: true,
        meta: { requestId: job.requestId, rungReached, durationMs: Date.now() - startedAt },
        data: assets,
      };
    }

    return failure('RENDER_ERROR', `Unsupported tool: ${job.tool as string}`, rungReached);
  } catch {
    return failure('RENDER_ERROR', 'Extraction failed.', rungReached);
  } finally {
    // Always close the context — a page/context that outlives its job is a
    // memory leak that compounds across thousands of requests/day (rule 2).
    await context.close();
  }
}

export async function startWorker(provider: SelfHostedProvider): Promise<WorkerHandle> {
  await provider.init();

  const semaphore = new Semaphore(RENDER_CONCURRENCY);

  const recycleInterval = setInterval(() => {
    const health = provider.health();
    if (health.uptimeMs >= BROWSER_RECYCLE_MINUTES * 60_000) {
      provider.recycle().catch(() => undefined);
    }
  }, 60_000);

  const bullWorker = new Worker<OcularJob, ResultEnvelope>(
    RENDER_QUEUE_NAME,
    async (job) => {
      await semaphore.acquire();
      try {
        const result = await processJob(provider, job.data);
        if (provider.health().requestsSinceRecycle >= BROWSER_RECYCLE_REQUESTS) {
          await provider.recycle();
        }
        // Reconcile the pre-enqueue quota reservation down to the actual
        // charge (docs/rules/11-billing-and-quota.md §2). Never let a
        // settlement failure fail the job itself — the render result is
        // already final; a missed refund is a billing-accuracy bug to
        // notice in logs, not a reason to report RENDER_ERROR back to the
        // agent for a page that actually rendered fine.
        try {
          await defaultQuotaSettler.settleQuota(job.data.account.id, job.data.requestId, result);
        } catch (error) {
          // no logger wired up yet; replace with pino at M1 (see main.ts)
          console.error('quota settlement failed', { requestId: job.data.requestId, error });
        }
        return result;
      } finally {
        semaphore.release();
      }
    },
    {
      connection: toConnectionOptions(config.redisUrl),
      concurrency: QUEUE_CONCURRENCY,
    },
  );

  return {
    stop: async () => {
      clearInterval(recycleInterval);
      await bullWorker.close();
      await provider.dispose();
      await defaultQuotaSettler.close();
    },
  };
}
