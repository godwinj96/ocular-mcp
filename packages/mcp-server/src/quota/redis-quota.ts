// Atomic Redis quota check/decrement — CLOUD PATH ONLY. See
// docs/rules/11-billing-and-quota.md §0b/§2. Must be checked BEFORE enqueue
// — never enqueue a job that will be billed against an exhausted account.
// Local-worker renders never touch this file (they're unmetered — see
// LOCAL_SUBSCRIPTION_GRACE_HOURS/subscription/validate.ts instead).
//
// Reserves MAX_RESERVE_CHARGE (the maximum possible per-request charge —
// SUCCESS_CHARGE at the most expensive rung multiplier, since the actual
// rung reached isn't known until the job resolves) at check time. The
// worker settles the actual charge (via chargeForEnvelope) after the job
// resolves and refunds the difference — see settle-quota.ts.

import type { Redis } from 'ioredis';
import { MAX_RESERVE_CHARGE, createQuotaReader, quotaKey } from '@ocular/shared';
import { redis } from '../db/redis.js';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
}

// Quota is a float (see docs/rules/11-billing-and-quota.md §1, because of
// fractional charge values) — never parseInt/round mid-calculation. TTL is
// only set on first creation of the key (KEYS[1]) so the daily window stays
// pinned to whenever the account's first render of the day happened,
// instead of sliding forward on every subsequent request.
const CHECK_AND_RESERVE_SCRIPT = `
local key = KEYS[1]
local reserveAmount = tonumber(ARGV[1])
local dailyQuota = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local currentRaw = redis.call('GET', key)
local current
local isNew = false
if currentRaw == false then
  current = dailyQuota
  isNew = true
else
  current = tonumber(currentRaw)
end

if current < reserveAmount then
  if isNew then
    redis.call('SET', key, current, 'EX', ttlSeconds)
  end
  return {0, tostring(current)}
end

local remaining = current - reserveAmount
if isNew then
  redis.call('SET', key, remaining, 'EX', ttlSeconds)
else
  redis.call('SET', key, remaining, 'KEEPTTL')
end
return {1, tostring(remaining)}
`;

const MIN_TTL_S = 60;

// Daily cap resets at UTC midnight — deliberately independent of the
// account's Bachs billing-cycle boundary (docs/rules/11-billing-and-quota.md
// §0b amendment: the daily render cap and the monthly billing cycle are two
// different things now, unlike the old flat-monthly-quota model where they
// were the same date).
function secondsUntilNextUtcMidnight(): number {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(Math.ceil((nextMidnight - now.getTime()) / 1000), MIN_TTL_S);
}

// Factory (not a bare module-scope function) so tests can point the check at
// a disposable Redis connection instead of the shared dev instance.
// dailyQuota is the caller-resolved per-plan-tier cap (DAILY_CLOUD_QUOTA_BY_TIER,
// keyed off the authenticated account's plan — see mcp/server.ts) rather than
// a single global constant, since Basic and Pro accounts have different caps.
export function createQuotaChecker(client: Redis) {
  return async function checkAndReserveQuota(
    accountId: string,
    dailyQuota: number,
  ): Promise<QuotaCheckResult> {
    const ttlSeconds = secondsUntilNextUtcMidnight();
    const raw = (await client.eval(
      CHECK_AND_RESERVE_SCRIPT,
      1,
      quotaKey(accountId),
      MAX_RESERVE_CHARGE,
      dailyQuota,
      ttlSeconds,
    )) as [number, string];

    return { allowed: raw[0] === 1, remaining: Number(raw[1]) };
  };
}

export const checkAndReserveQuota = createQuotaChecker(redis);

// Read-only peek for get_quota — never reserves/decrements. The key shape and
// "missing key = full dailyQuota" semantics are the shared contract in
// @ocular/shared's quota.ts (the dashboard's usage surface reads the exact
// same thing); only the Redis client itself is supplied locally. CLOUD PATH
// ONLY — see get-quota.ts for the response framing that makes this explicit
// to the calling agent.
export const getQuotaStatus = createQuotaReader(redis);
