// Atomic Redis sliding-window rate limit. See docs/rules/07-security.md §4
// and docs/rules/11-billing-and-quota.md §0 — this is the backstop for the
// half-charge-on-failure billing policy, independent of monthly quota.
// Checked in the same mcp-server pipeline stage as the quota check, before
// enqueue: a rejection here must never enqueue a job or touch quota.

import type { Redis } from 'ioredis';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_S } from '@ocular/shared';
import { redis } from '../db/redis.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

// Sliding-window-log via a sorted set: score = request timestamp (ms). Each
// call atomically trims entries older than the window, counts what's left,
// and only adds itself if under the cap — so a request that gets rejected
// doesn't still consume a slot. EXPIRE keeps the key from growing unbounded
// for an account that stops calling entirely.
const CHECK_AND_RECORD_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)
local current = redis.call('ZCARD', key)

if current >= maxRequests then
  return {0, tostring(maxRequests - current)}
end

redis.call('ZADD', key, now, now .. '-' .. math.random())
redis.call('PEXPIRE', key, windowMs)
return {1, tostring(maxRequests - current - 1)}
`;

function rateLimitKey(accountId: string): string {
  return `ratelimit:${accountId}`;
}

// Factory (not a bare module-scope function) so tests can point the check at
// a disposable Redis connection instead of the shared dev instance — same
// pattern as createQuotaChecker in ../quota/redis-quota.ts.
export function createRateLimiter(client: Redis) {
  return async function checkAndRecordRateLimit(accountId: string): Promise<RateLimitResult> {
    const raw = (await client.eval(
      CHECK_AND_RECORD_SCRIPT,
      1,
      rateLimitKey(accountId),
      Date.now(),
      RATE_LIMIT_WINDOW_S * 1000,
      RATE_LIMIT_MAX_REQUESTS,
    )) as [number, string];

    return { allowed: raw[0] === 1, remaining: Number(raw[1]) };
  };
}

export const checkAndRecordRateLimit = createRateLimiter(redis);
