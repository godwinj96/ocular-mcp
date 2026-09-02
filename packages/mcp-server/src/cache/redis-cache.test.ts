import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { computeCacheKey } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { config } from '../config.js';
import { createCacheReader } from './redis-cache.js';

describe('createCacheReader', () => {
  const client = new Redis(config.redisUrl);
  const getCachedEnvelope = createCacheReader(client);
  const usedKeys: string[] = [];

  afterAll(async () => {
    if (usedKeys.length > 0) await client.del(...usedKeys);
    client.disconnect();
  });

  it('returns null on a cache miss', async () => {
    const args = {
      url: `https://example.com/${randomUUID()}`,
      detail: 'balanced',
      full_page: false,
    };
    const result = await getCachedEnvelope('view_page', args);
    expect(result).toBeNull();
  });

  it('returns the exact stored envelope on a hit', async () => {
    const args = {
      url: `https://example.com/${randomUUID()}`,
      detail: 'balanced',
      full_page: false,
    };
    const key = computeCacheKey('view_page', args);
    usedKeys.push(key);

    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      image: { b64: 'abc', mime: 'image/webp', w: 10, h: 10, bytes: 3 },
    };
    await client.set(key, JSON.stringify(envelope), 'EX', 60);

    const result = await getCachedEnvelope('view_page', args);
    expect(result).toEqual(envelope);
  });

  it('treats a corrupted cache entry as a miss, not a crash', async () => {
    const args = {
      url: `https://example.com/${randomUUID()}`,
      detail: 'balanced',
      full_page: false,
    };
    const key = computeCacheKey('view_page', args);
    usedKeys.push(key);

    await client.set(key, 'not valid json{{{', 'EX', 60);

    const result = await getCachedEnvelope('view_page', args);
    expect(result).toBeNull();
  });

  it('ignores the fresh flag when deriving the key — a fresh:true read still hits the same key a fresh:false write would use', async () => {
    const args = {
      url: `https://example.com/${randomUUID()}`,
      detail: 'balanced',
      full_page: false,
    };
    const key = computeCacheKey('view_page', { ...args, fresh: false });
    usedKeys.push(key);

    const envelope: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'r', rungReached: 0, durationMs: 1 },
      data: { hello: 'world' },
    };
    await client.set(key, JSON.stringify(envelope), 'EX', 60);

    const result = await getCachedEnvelope('view_page', { ...args, fresh: true });
    expect(result).toEqual(envelope);
  });
});
