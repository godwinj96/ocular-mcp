// Cloud cache — WRITE ONLY from this package. See docs/rules/05-worker-and-browser-pipeline.md
// §5a: "the cloud cache is populated exclusively by the cloud worker's own
// successful renders" — this is the only file in the codebase that ever
// SETs this key namespace. packages/mcp-server/src/cache/redis-cache.ts
// reads the same keys but has no write function; packages/local-worker
// never receives Redis credentials at all (see its config.ts — only
// OCULAR_CLOUD_MCP_URL/OCULAR_API_KEY), so "nothing from a local render
// reaches the cloud cache" (docs/rules/13-local-worker-and-distribution.md
// §7) is enforced by credential absence, not just an import-boundary lint
// rule — a stronger guarantee than convention alone.
//
// Only successful envelopes are ever cached — a failure (BLOCKED, TIMEOUT,
// etc.) is never worth caching and would otherwise serve a stale error to
// every subsequent identical request until the TTL naturally expired.

import { Redis } from 'ioredis';
import { CACHE_TTL_STANDARD_S, computeCacheKey, isCacheableUrl } from '@ocular/shared';
import type { ResultEnvelope, ToolName } from '@ocular/shared';
import { config } from '../config.js';

// Factory (not a bare module-scope singleton) so tests can point this at a
// disposable Redis connection — same pattern as routing-memory and
// settle-quota.ts.
export function createCacheWriter(redisUrl: string) {
  const redis = new Redis(redisUrl);

  async function setCachedEnvelope(
    tool: ToolName,
    args: Record<string, unknown>,
    envelope: ResultEnvelope,
    ttlSeconds: number = CACHE_TTL_STANDARD_S,
  ): Promise<void> {
    if (!envelope.ok) return; // never cache a failure — see header comment.
    const url = typeof args.url === 'string' ? args.url : undefined;
    if (!url || !isCacheableUrl(url)) return; // never cache a secret/session-shaped URL — see cache-key.ts.
    await redis.set(computeCacheKey(tool, args), JSON.stringify(envelope), 'EX', ttlSeconds);
  }

  async function close(): Promise<void> {
    await redis.quit();
  }

  return { setCachedEnvelope, close };
}

export const defaultCacheWriter = createCacheWriter(config.redisUrl);
