import { randomUUID } from 'node:crypto';
import { Worker } from 'bullmq';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { RENDER_QUEUE_NAME } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { config } from '../config.js';
import { createJobEnqueuer } from './enqueue.js';

// Runs against the real Upstash dev instance (config.redisUrl). worker.ts
// (the real BullMQ consumer) is still a stub — see DEVLOG.md — so this test
// stands up a minimal inline Worker to play that role, proving the producer
// side (job shape, name, connection options, wait-for-result) is wired
// correctly end-to-end rather than only unit-testing it in isolation.
vi.setConfig({ testTimeout: 20_000 });

function connectionOptionsFor(connectionUrl: string) {
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

describe('createJobEnqueuer', () => {
  const enqueuer = createJobEnqueuer(config.redisUrl);

  afterAll(async () => {
    await enqueuer.close();
  });

  it('enqueues a job and resolves with the envelope the consumer returns', async () => {
    // Scoped to this test — closed before returning so it can't also pick up
    // the next test's "no consumer" job.
    const worker = new Worker(
      RENDER_QUEUE_NAME,
      async (job) => ({
        ok: true,
        meta: { requestId: job.data.requestId, rungReached: 0, durationMs: 1 },
        data: { hello: 'world' },
      }),
      { connection: connectionOptionsFor(config.redisUrl) },
    );
    await worker.waitUntilReady();

    try {
      const requestId = randomUUID();
      const result = await enqueuer.enqueueAndAwait({
        tool: 'get_quota',
        args: {},
        account: { id: 'acct_1', plan: 'starter' },
        requestId,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.meta.requestId).toBe(requestId);
        expect(result.data).toEqual({ hello: 'world' });
      }
    } finally {
      await worker.close();
    }
  });

  it('resolves with a TIMEOUT envelope when nothing consumes the job', async () => {
    // No worker listening in this test — SERVER_AWAIT_MS (12s) must elapse.
    const result: ResultEnvelope = await enqueuer.enqueueAndAwait({
      tool: 'get_quota',
      args: {},
      account: { id: 'acct_1', plan: 'starter' },
      requestId: randomUUID(),
    });

    expect(result).toEqual({
      ok: false,
      reason: 'TIMEOUT',
      message: 'The request did not complete within the allotted time.',
      rungReached: 0,
    });
  });
});
