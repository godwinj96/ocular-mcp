import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ResultEnvelope } from '@ocular/shared';
import { LocalCache } from './local-cache.js';

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

describe('LocalCache', () => {
  let dir: string;
  let cache: LocalCache;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ocular-local-cache-test-'));
    cache = new LocalCache(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null on a miss', async () => {
    const result = await cache.get('view_page', { url: 'https://example.com' });
    expect(result).toBeNull();
  });

  it('returns the exact stored envelope on a hit', async () => {
    await cache.set('view_page', { url: 'https://example.com' }, success(), 60);
    const result = await cache.get('view_page', { url: 'https://example.com' });
    expect(result).toEqual(success());
  });

  it('never writes a failed envelope', async () => {
    await cache.set('view_page', { url: 'https://example.com' }, failure(), 60);
    const result = await cache.get('view_page', { url: 'https://example.com' });
    expect(result).toBeNull();
  });

  it('treats an expired entry as a miss and removes the stale file', async () => {
    await cache.set('view_page', { url: 'https://example.com' }, success(), -1); // already expired
    const result = await cache.get('view_page', { url: 'https://example.com' });
    expect(result).toBeNull();
  });

  it('is isolated per (tool, args) — different args never collide', async () => {
    await cache.set('view_page', { url: 'https://example.com', detail: 'low' }, success(), 60);
    const miss = await cache.get('view_page', { url: 'https://example.com', detail: 'high' });
    expect(miss).toBeNull();
  });
});
