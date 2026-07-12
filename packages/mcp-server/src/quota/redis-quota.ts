// Atomic Redis quota check/decrement. See docs/rules/11-billing-and-quota.md §2.
// Must be checked BEFORE enqueue — never enqueue a job that will be billed
// against an exhausted account.
//
// Reserves SUCCESS_CHARGE (the maximum possible per-request charge) at check
// time. The worker settles the actual charge (1.0 or 0.5) after the job
// resolves — designing that reservation/reconciliation model is explicitly
// scoped to M5 (see docs/rules/11-billing-and-quota.md §2), not this file.

import type { Redis } from 'ioredis';
import { MONTHLY_QUOTA, SUCCESS_CHARGE } from '@ocular/shared';
import { redis } from '../db/redis.js';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
}

// Quota is a float (see docs/rules/11-billing-and-quota.md §1, because of the
// 0.5 half-charge value) — never parseInt/round mid-calculation. TTL is only
// set on first creation of the key (KEYS[1]) so it stays pinned to the
// account's actual billing-cycle boundary instead of sliding forward on every
// request.
const CHECK_AND_RESERVE_SCRIPT = `
local key = KEYS[1]
local reserveAmount = tonumber(ARGV[1])
local monthlyQuota = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local currentRaw = redis.call('GET', key)
local current
local isNew = false
if currentRaw == false then
  current = monthlyQuota
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

const THIRTY_DAYS_S = 60 * 60 * 24 * 30;
const MIN_TTL_S = 60;

function quotaKey(accountId: string): string {
  return `quota:${accountId}`;
}

function ttlSecondsUntil(resetAt: Date | null): number {
  if (!resetAt) return THIRTY_DAYS_S; // no known reset date yet — safe rolling fallback
  const seconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
  return Math.max(seconds, MIN_TTL_S);
}

// Factory (not a bare module-scope function) so tests can point the check at
// a disposable Redis connection instead of the shared dev instance.
export function createQuotaChecker(client: Redis) {
  return async function checkAndReserveQuota(
    accountId: string,
    quotaResetAt: Date | null = null,
  ): Promise<QuotaCheckResult> {
    const ttlSeconds = ttlSecondsUntil(quotaResetAt);
    const raw = (await client.eval(
      CHECK_AND_RESERVE_SCRIPT,
      1,
      quotaKey(accountId),
      SUCCESS_CHARGE,
      MONTHLY_QUOTA,
      ttlSeconds,
    )) as [number, string];

    return { allowed: raw[0] === 1, remaining: Number(raw[1]) };
  };
}

export const checkAndReserveQuota = createQuotaChecker(redis);

// Read-only peek for get_quota — never reserves/decrements. A missing key
// means the account hasn't made a chargeable call yet this cycle, so the
// full MONTHLY_QUOTA is still available (matches checkAndReserveQuota's own
// "no key yet" initialization value).
export function createQuotaReader(client: Redis) {
  return async function getQuotaStatus(accountId: string): Promise<{ remaining: number }> {
    const raw = await client.get(quotaKey(accountId));
    return { remaining: raw === null ? MONTHLY_QUOTA : Number(raw) };
  };
}

export const getQuotaStatus = createQuotaReader(redis);
