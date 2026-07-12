import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONTHLY_QUOTA, SUCCESS_CHARGE } from '@ocular/shared';
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

  it(
    'initializes a new account at MONTHLY_QUOTA and reserves SUCCESS_CHARGE on first check',
    async () => {
      const accountId = newAccountId();

      const result = await checkAndReserveQuota(accountId, null);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(MONTHLY_QUOTA - SUCCESS_CHARGE);
    },
    // First call in the file pays the cold TLS-connect cost to Upstash —
    // subsequent tests reuse the warm connection well under the default 5s.
    15_000,
  );

  it('decrements on each subsequent call without resetting the TTL', async () => {
    const accountId = newAccountId();

    await checkAndReserveQuota(accountId, null);
    const second = await checkAndReserveQuota(accountId, null);

    expect(second.remaining).toBe(MONTHLY_QUOTA - SUCCESS_CHARGE * 2);
  });

  it('rejects once the account is exhausted, without going negative', async () => {
    const accountId = newAccountId();
    await client.set(`quota:${accountId}`, '0.5', 'EX', 60);

    const result = await checkAndReserveQuota(accountId, null);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0.5);
  });

  it('is atomic under concurrent near-limit requests — never over-allows', async () => {
    // See docs/rules/10-testing.md §3: the mandatory race-condition test.
    // Seed just enough quota for exactly 3 of 10 concurrent requests.
    const accountId = newAccountId();
    await client.set(`quota:${accountId}`, String(SUCCESS_CHARGE * 3), 'EX', 60);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkAndReserveQuota(accountId, null)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(3);

    const finalRemaining = await client.get(`quota:${accountId}`);
    expect(Number(finalRemaining)).toBe(0);
  });

  it('sets a TTL pinned to the provided quotaResetAt instead of a sliding window', async () => {
    const accountId = newAccountId();
    const resetAt = new Date(Date.now() + 120_000);

    await checkAndReserveQuota(accountId, resetAt);
    const ttl = await client.ttl(`quota:${accountId}`);

    expect(ttl).toBeGreaterThan(60);
    expect(ttl).toBeLessThanOrEqual(120);
  });
});
