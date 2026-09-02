// Global daily circuit breaker on Rung-3 (paid unblocker) spend. See
// docs/rules/08-performance.md §0/§3 and docs/rules/06-external-fetching-and-egress.md
// §3 — Decodo costs real money per call (~$0.0015), so an attacker (or a
// runaway retry loop) hammering half-charge failures that each still attempt
// rung 3 is a real vendor-cost exposure, not just a quota-exhaustion
// nuisance. This is a global cap across all accounts, not per-account —
// distinct from and in addition to each account's own daily render quota
// (DAILY_CLOUD_QUOTA_BY_TIER).
//
// Atomic INCRBYFLOAT-then-check via Lua so concurrent workers can't both read
// a stale total and both proceed past the cap.

import { Redis } from 'ioredis';
import { DAILY_PAID_BUDGET_USD } from '@ocular/shared';
import { config } from '../config.js';

// Decodo Site Unblocker's per-call cost, per docs/rules/08-performance.md §3
// ("~$0.0015/call"). Reserved optimistically before the call (like quota's
// MAX_RESERVE_CHARGE) since the alternative — spending first, checking after
// — can't actually prevent the overspend it's meant to guard against.
export const PAID_UNBLOCKER_COST_USD = 0.0015;

const MIN_TTL_S = 60;

function paidBudgetKey(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  return `paid-budget:${today}`;
}

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

// Reserves ARGV[1] against the daily cap unless doing so would exceed it.
// Mirrors redis-quota.ts's CHECK_AND_RESERVE_SCRIPT shape (single atomic
// EVAL, TTL only set on first creation so the window doesn't slide).
const RESERVE_SCRIPT = `
local key = KEYS[1]
local reserveAmount = tonumber(ARGV[1])
local dailyBudget = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local currentRaw = redis.call('GET', key)
local spent
local isNew = false
if currentRaw == false then
  spent = 0
  isNew = true
else
  spent = tonumber(currentRaw)
end

if spent + reserveAmount > dailyBudget then
  return 0
end

local newSpent = spent + reserveAmount
if isNew then
  redis.call('SET', key, newSpent, 'EX', ttlSeconds)
else
  redis.call('SET', key, newSpent, 'KEEPTTL')
end
return 1
`;

// Factory (not a bare module-scope singleton) so tests can point this at a
// disposable Redis connection — same pattern as routing-memory/redis-quota.
export function createPaidBudgetGuard(client: Redis) {
  return async function tryReservePaidBudget(): Promise<boolean> {
    const ttlSeconds = secondsUntilNextUtcMidnight();
    const raw = (await client.eval(
      RESERVE_SCRIPT,
      1,
      paidBudgetKey(),
      PAID_UNBLOCKER_COST_USD,
      DAILY_PAID_BUDGET_USD,
      ttlSeconds,
    )) as number;
    return raw === 1;
  };
}

const defaultRedis = new Redis(config.redisUrl);

export const tryReservePaidBudget: () => Promise<boolean> = createPaidBudgetGuard(defaultRedis);
