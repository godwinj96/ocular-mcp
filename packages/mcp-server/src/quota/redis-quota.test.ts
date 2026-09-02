import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DAILY_CLOUD_QUOTA_BY_TIER, MAX_RESERVE_CHARGE } from '@ocular/shared';

const DAILY_CLOUD_QUOTA = DAILY_CLOUD_QUOTA_BY_TIER.basic;
import { config } from '../config.js';
import { createQuotaChecker } from './redis-quota.js';

// Runs against the real Upstash dev instance (config.redisUrl) rather than a
// mock — per docs/rules/10-testing.md §1, Redis is only mocked for pure unit
// tests; the atomic check-and-decrement Lua script is exactly the kind of
// logic that must be proven against a real Redis. Each test uses a unique
// account id and deletes its key afterward so runs don't collide or leak.
describe('checkAndReserveQuota', () => {
  const client = new Redis(config.redisUrl);
  const checkAndReserveQuota = createQuotaChecker(client);
  const usedKeys: string[] = [];

  function newAccountId(): string {
    const id = `test-${randomUUID()}`;
    usedKeys.push(`quota:${id}`);
    return id;
  }

  beforeEach(() => {
    usedKeys.length = 0;
  });

  afterAll(async () => {
    if (usedKeys.length > 0) await client.del(...usedKeys);
    client.disconnect();
  });

  it('initializes a new account at DAILY_CLOUD_QUOTA and reserves MAX_RESERVE_CHARGE on first check', async () => {
    const accountId = newAccountId();

    const result = await checkAndReserveQuota(accountId, DAILY_CLOUD_QUOTA);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(DAILY_CLOUD_QUOTA - MAX_RESERVE_CHARGE);
  }, // First call in the file pays the cold TLS-connect cost to Upstash —
  // subsequent tests reuse the warm connection well under the default 5s.
  15_000);

  it('decrements on each subsequent call without resetting the TTL', async () => {
    const accountId = newAccountId();

    await checkAndReserveQuota(accountId, DAILY_CLOUD_QUOTA);
    const second = await checkAndReserveQuota(accountId, DAILY_CLOUD_QUOTA);

    expect(second.remaining).toBe(DAILY_CLOUD_QUOTA - MAX_RESERVE_CHARGE * 2);
  });

  it('rejects once the account is exhausted, without going negative', async () => {
    const accountId = newAccountId();
    await client.set(`quota:${accountId}`, '0.5', 'EX', 60);

    const result = await checkAndReserveQuota(accountId, DAILY_CLOUD_QUOTA);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0.5);
  });

  it('is atomic under concurrent near-limit requests — never over-allows', async () => {
    // See docs/rules/10-testing.md §3: the mandatory race-condition test.
    // Seed just enough quota for exactly 3 of 10 concurrent requests.
    const accountId = newAccountId();
    await client.set(`quota:${accountId}`, String(MAX_RESERVE_CHARGE * 3), 'EX', 60);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkAndReserveQuota(accountId, DAILY_CLOUD_QUOTA)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(3);

    const finalRemaining = await client.get(`quota:${accountId}`);
    expect(Number(finalRemaining)).toBe(0);
  });

  it('sets a TTL pinned to the next UTC midnight, not a sliding window', async () => {
    const accountId = newAccountId();

    await checkAndReserveQuota(accountId, DAILY_CLOUD_QUOTA);
    const ttl = await client.ttl(`quota:${accountId}`);

    // Can't assert an exact value (depends on time-of-day the suite runs),
    // but it must be a same-day-bounded window: > 1 minute (MIN_TTL_S floor)
    // and <= 24h, never the old 30-day rolling fallback.
    expect(ttl).toBeGreaterThan(60);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60);
  });
});
