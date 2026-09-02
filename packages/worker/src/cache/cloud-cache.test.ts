import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { computeCacheKey } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { config } from '../config.js';
import { createCacheWriter } from './cloud-cache.js';

// Runs against the real dev Upstash Redis — per docs/rules/10-testing.md
// §1, Redis-touching logic must be proven against real infra, not a mock.
describe('createCacheWriter', () => {
  const client = new Redis(config.redisUrl);
  const writer = createCacheWriter(config.redisUrl);
  const usedKeys: string[] = [];

  afterAll(async () => {
    if (usedKeys.length > 0) await client.del(...usedKeys);
    await writer.close();
    client.disconnect();
  });

  function success(): ResultEnvelope {
    return {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      image: { b64: 'abc', mime: 'image/webp', w: 10, h: 10, bytes: 3 },
    };
  }

  function failure(): ResultEnvelope {
    return { ok: false, reason: 'BLOCKED', message: 'x', rungReached: 1 };
  }

  it('writes a successful envelope, readable back as the exact JSON that was stored', async () => {
    const url = `https://example.com/${randomUUID()}`;
    const args = { url, detail: 'balanced', full_page: false };
    const key = computeCacheKey('view_page', args);
    usedKeys.push(key);

    await writer.setCachedEnvelope('view_page', args, success(), 60);

    const raw = await client.get(key);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(success());
  }, // First call in the file pays the cold TLS-connect cost to Upstash —
  // same pattern as redis-quota.test.ts/settle-quota.test.ts.
  15_000);

  it('never writes a failed envelope — a failure must not poison the cache for subsequent requests', async () => {
    const url = `https://example.com/${randomUUID()}`;
    const args = { url, detail: 'balanced', full_page: false };
    const key = computeCacheKey('view_page', args);
    usedKeys.push(key);

    await writer.setCachedEnvelope('view_page', args, failure(), 60);

    const raw = await client.get(key);
    expect(raw).toBeNull();
  });

  it('sets the requested TTL', async () => {
    const url = `https://example.com/${randomUUID()}`;
    const args = { url, detail: 'balanced', full_page: false };
    const key = computeCacheKey('view_page', args);
    usedKeys.push(key);

    await writer.setCachedEnvelope('view_page', args, success(), 120);

    const ttl = await client.ttl(key);
    expect(ttl).toBeGreaterThan(60);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('never writes a URL carrying a query string, userinfo, or secret-shaped path — see cache-key.ts isCacheableUrl', async () => {
    const secretUrls = [
      `https://example.com/${randomUUID()}?token=abc123`,
      `https://user:pass@example.com/${randomUUID()}`,
      `https://example.com/reset-password/${randomUUID()}`,
      `https://example.com/invite/${randomUUID()}`,
    ];

    for (const url of secretUrls) {
      const args = { url, detail: 'balanced', full_page: false };
      const key = computeCacheKey('view_page', args);
      usedKeys.push(key);

      await writer.setCachedEnvelope('view_page', args, success(), 60);

      const raw = await client.get(key);
      expect(raw).toBeNull();
    }
  });
});
