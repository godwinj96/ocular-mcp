// BullMQ producer + await. See docs/rules/04-mcp-server-and-auth.md §3 steps 7-8.

import { Queue, QueueEvents } from 'bullmq';
import { JOB_DEADLINE_MS, RENDER_QUEUE_NAME, SERVER_AWAIT_MS } from '@ocular/shared';
import type { OcularJob, OcularJobAccount, ResultEnvelope, ToolName } from '@ocular/shared';
import { config } from '../config.js';

export interface EnqueueAndAwaitInput<TInput> {
  tool: ToolName;
  args: TInput;
  account: OcularJobAccount;
  requestId: string;
}

export interface JobEnqueuer {
  enqueueAndAwait<TInput>(input: EnqueueAndAwaitInput<TInput>): Promise<ResultEnvelope>;
  close(): Promise<void>;
}

function timeoutEnvelope(): ResultEnvelope {
  return {
    ok: false,
    reason: 'TIMEOUT',
    message: 'The request did not complete within the allotted time.',
    rungReached: 0,
  };
}

// BullMQ bundles its own private copy of ioredis, which is a structurally
// (near-)identical but nominally distinct type from this package's own
// `ioredis` dependency — passing a `new Redis()` instance from the wrong
// copy fails type-checking even though it works at runtime. Passing a plain
// RedisOptions-shaped object instead sidesteps the class-identity mismatch:
// BullMQ constructs the connection internally using its own bundled ioredis.
function toConnectionOptions(connectionUrl: string) {
  const parsed = new URL(connectionUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ's blocking QueueEvents stream connection.
    maxRetriesPerRequest: null,
  };
}

// Factory (not a bare module-scope singleton) so tests can point the queue at
// a disposable connection instead of the shared dev Redis instance — same
// pattern as verify-authkit-token.ts's createAuthKitVerifier. Queue and
// QueueEvents each get their own connection options object (not shared).
export function createJobEnqueuer(connectionUrl: string): JobEnqueuer {
  const queue = new Queue<OcularJob>(RENDER_QUEUE_NAME, {
    connection: toConnectionOptions(connectionUrl),
  });
  const events = new QueueEvents(RENDER_QUEUE_NAME, {
    connection: toConnectionOptions(connectionUrl),
  });

  async function enqueueAndAwait<TInput>(input: EnqueueAndAwaitInput<TInput>): Promise<ResultEnvelope> {
    const job: OcularJob<TInput> = {
      ...input,
      deadlineMs: Date.now() + JOB_DEADLINE_MS,
    };

    // The BullMQ job *name* is fixed — the actual tool identity travels in
    // the payload (`job.tool`), not the job name, so worker.ts can dispatch
    // on one BullMQ Worker processor regardless of tool.
    const bullJob = await queue.add(RENDER_QUEUE_NAME, job, {
      jobId: job.requestId,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });

    try {
      const result = await bullJob.waitUntilFinished(events, SERVER_AWAIT_MS);
      return result as ResultEnvelope;
    } catch {
      // Covers both a real SERVER_AWAIT_MS timeout and a BullMQ-level job
      // failure/removal. The worker is expected to resolve with a
      // FailureEnvelope for expected failures, not throw (see
      // docs/rules/05-worker-and-browser-pipeline.md), so any rejection here
      // is treated as TIMEOUT either way — mcp-server never leaks a raw
      // BullMQ error to the client.
      return timeoutEnvelope();
    }
  }

  async function close(): Promise<void> {
    await Promise.all([queue.close(), events.close()]);
  }

  return { enqueueAndAwait, close };
}

const defaultEnqueuer = createJobEnqueuer(config.redisUrl);

export const enqueueAndAwait: JobEnqueuer['enqueueAndAwait'] = (input) => defaultEnqueuer.enqueueAndAwait(input);
