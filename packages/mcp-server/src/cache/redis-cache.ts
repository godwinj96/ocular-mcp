// Cloud cache — READ ONLY from this package. See docs/rules/05-worker-and-browser-pipeline.md
// §5a: the cloud cache is populated exclusively by the cloud worker's own
// successful renders (packages/worker/src/cache/cloud-cache.ts owns the
// write path) — this file deliberately has no write function at all, not
// just "doesn't call one." mcp-server checking the cache before enqueueing
// is what turns a hit into a free response (no quota reservation, no
// BullMQ round-trip) — see docs/rules/11-billing-and-quota.md §9's
// cache-hit-is-free decision.

import type { Redis } from 'ioredis';
import { computeCacheKey } from '@ocular/shared';
import type { ResultEnvelope, ToolName } from '@ocular/shared';
import { redis } from '../db/redis.js';

// Factory (not a bare module-scope function) so tests can point this at a
// disposable Redis connection — same pattern as quota/redis-quota.ts.
export function createCacheReader(client: Redis) {
  return async function getCachedEnvelope(
    tool: ToolName,
    args: Record<string, unknown>,
  ): Promise<ResultEnvelope | null> {
    const raw = await client.get(computeCacheKey(tool, args));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ResultEnvelope;
    } catch {
      // A corrupted cache entry is a cache miss, not a crash — re-render
      // rather than serve garbage. Not expected in practice (only worker's
      // own JSON.stringify writes this key), defensive nonetheless.
      return null;
    }
  };
}

export const getCachedEnvelope = createCacheReader(redis);
