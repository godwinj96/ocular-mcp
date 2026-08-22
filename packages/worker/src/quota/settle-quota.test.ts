import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { EXHAUSTED_FAILURE_CHARGE, MONTHLY_QUOTA, SUCCESS_CHARGE } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { config } from '../config.js';
import { createQuotaSettler } from './settle-quota.js';

function success(): ResultEnvelope {
  return { ok: true, meta: { requestId: 'r', rungReached: 1, durationMs: 1 } };
}

function blocked(): ResultEnvelope {
  return { ok: false, reason: 'BLOCKED', message: 'x', rungReached: 2 };
}

function ssrfBlocked(): ResultEnvelope {
  return { ok: false, reason: 'SSRF_BLOCKED', message: 'x', rungReached: 0 };
}

// Runs against the real Upstash dev instance (config.redisUrl) — per
// docs/rules/10-testing.md §1, the atomic settle script must be proven
// against a real Redis, not a mock.
describe('createQuotaSettler', () => {
  const client = new Redis(config.redisUrl);
  const settler = createQuotaSettler(config.redisUrl);
  const usedKeys: string[] = [];

  function newIds(): { accountId: string; requestId: string } {
    const accountId = `test-${randomUUID()}`;
    const requestId = randomUUID();
    usedKeys.push(`quota:${accountId}`, `quota-settled:${requestId}`);
    return { accountId, requestId };
  }

  beforeEach(() => {
    usedKeys.length = 0;
  });

  afterAll(async () => {
    if (usedKeys.length > 0) await client.del(...usedKeys);
    await settler.close();
    client.disconnect();
  });

  it('refunds SUCCESS_CHARGE - EXHAUSTED_FAILURE_CHARGE for a half-charge outcome', async () => {
    const { accountId, requestId } = newIds();
    // Simulate mcp-server's pre-enqueue reservation.
    await client.set(`quota:${accountId}`, String(MONTHLY_QUOTA - SUCCESS_CHARGE), 'EX', 60);

    await settler.settleQuota(accountId, requestId, blocked());

    const remaining = await client.get(`quota:${accountId}`);
    expect(Number(remaining)).toBeCloseTo(MONTHLY_QUOTA - EXHAUSTED_FAILURE_CHARGE, 5);
  }, 15_000);

  it('refunds the full reservation for a no-charge outcome (e.g. worker-layer SSRF_BLOCKED)', async () => {
    const { accountId, requestId } = newIds();
    await client.set(`quota:${accountId}`, String(MONTHLY_QUOTA - SUCCESS_CHARGE), 'EX', 60);

    await settler.settleQuota(accountId, requestId, ssrfBlocked());

    const remaining = await client.get(`quota:${accountId}`);
    expect(Number(remaining)).toBeCloseTo(MONTHLY_QUOTA, 5);
  });

  it('leaves the reservation untouched for a full-charge success', async () => {
    const { accountId, requestId } = newIds();
    await client.set(`quota:${accountId}`, String(MONTHLY_QUOTA - SUCCESS_CHARGE), 'EX', 60);

    await settler.settleQuota(accountId, requestId, success());

    const remaining = await client.get(`quota:${accountId}`);
    expect(Number(remaining)).toBeCloseTo(MONTHLY_QUOTA - SUCCESS_CHARGE, 5);
  });

  it('is idempotent — a duplicate settlement call for the same requestId never refunds twice', async () => {
    const { accountId, requestId } = newIds();
    await client.set(`quota:${accountId}`, String(MONTHLY_QUOTA - SUCCESS_CHARGE), 'EX', 60);

    await settler.settleQuota(accountId, requestId, blocked());
    await settler.settleQuota(accountId, requestId, blocked());

    const remaining = await client.get(`quota:${accountId}`);
    expect(Number(remaining)).toBeCloseTo(MONTHLY_QUOTA - EXHAUSTED_FAILURE_CHARGE, 5);
  });

  it('skips the refund if the quota key already expired (billing cycle rolled over)', async () => {
    const { accountId, requestId } = newIds();
    // No key set — simulates the reservation's TTL having already elapsed.

    await settler.settleQuota(accountId, requestId, blocked());

    const remaining = await client.get(`quota:${accountId}`);
    expect(remaining).toBeNull();
  });
});
