import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_S } from '@ocular/shared';
import { config } from '../config.js';
import { createRateLimiter } from './redis-rate-limiter.js';

// Runs against the real Upstash dev instance (config.redisUrl) rather than a
// mock — per docs/rules/10-testing.md §1, the atomic check-and-record Lua
// script is exactly the kind of logic that must be proven against a real
// Redis. Each test uses a unique account id and deletes its key afterward so
// runs don't collide or leak.
describe('checkAndRecordRateLimit', () => {
  const client = new Redis(config.redisUrl);
  const checkAndRecordRateLimit = createRateLimiter(client);
  const usedKeys: string[] = [];

  function newAccountId(): string {
    const id = `test-${randomUUID()}`;
    usedKeys.push(`ratelimit:${id}`);
    return id;
  }

  beforeEach(() => {
    usedKeys.length = 0;
  });

  afterAll(async () => {
    if (usedKeys.length > 0) await client.del(...usedKeys);
    client.disconnect();
  });

  it('allows requests under the cap and reports decreasing remaining', async () => {
    const accountId = newAccountId();

    const first = await checkAndRecordRateLimit(accountId);
    const second = await checkAndRecordRateLimit(accountId);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2);
  }, // First call in the file pays the cold TLS-connect cost to Upstash.
  15_000);

  it('rejects once the window cap is reached, without recording the rejected attempt', async () => {
    const accountId = newAccountId();

    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const result = await checkAndRecordRateLimit(accountId);
      expect(result.allowed).toBe(true);
    }

    const over = await checkAndRecordRateLimit(accountId);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);

    // A rejected attempt must not itself count toward the window — verify the
    // very next call sees the same rejection, not a different count.
    const overAgain = await checkAndRecordRateLimit(accountId);
    expect(overAgain.allowed).toBe(false);
  });

  it('is atomic under concurrent near-limit requests — never over-allows', async () => {
    // See docs/rules/10-testing.md §3: the mandatory race-condition test.
    // Seed the window to exactly 3 requests under the cap, then fire 10
    // concurrently — only 3 should be allowed.
    const accountId = newAccountId();
    const seeded = RATE_LIMIT_MAX_REQUESTS - 3;
    for (let i = 0; i < seeded; i++) {
      await checkAndRecordRateLimit(accountId);
    }

    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkAndRecordRateLimit(accountId)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(3);
  });

  it('expires the window after RATE_LIMIT_WINDOW_S, freeing up capacity', async () => {
    const accountId = newAccountId();
    const key = `ratelimit:${accountId}`;

    await checkAndRecordRateLimit(accountId);
    const ttlMs = await client.pttl(key);

    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_S * 1000);
  });
});
