// Post-job quota reconciliation — CLOUD PATH ONLY. See
// docs/rules/11-billing-and-quota.md §2: mcp-server reserves
// MAX_RESERVE_CHARGE atomically before enqueue (the highest possible
// per-request charge, since the rung actually reached isn't known until the
// job resolves); this settles the difference down to the actual
// rung-multiplied charge (chargeForEnvelope, in @ocular/shared) once the job
// resolves, via a second atomic operation keyed by requestId — never a
// second independent decrement that could double-charge or under-charge a
// slow job.

import { Redis } from 'ioredis';
import { chargeForEnvelope, MAX_RESERVE_CHARGE } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { config } from '../config.js';

// Idempotency guard TTL — only needs to outlive any plausible retry/duplicate
// delivery window, not the account's billing cycle (unlike the quota key
// itself). A day is generous headroom over BullMQ's attempts:1 + JOB_DEADLINE_MS.
const SETTLEMENT_GUARD_TTL_S = 60 * 60 * 24;

function quotaKey(accountId: string): string {
  return `quota:${accountId}`;
}

function settlementGuardKey(requestId: string): string {
  return `quota-settled:${requestId}`;
}

// Refunds the gap between the pre-enqueue reservation and the actual charge.
// Guarded by requestId so a duplicate call (e.g. a settlement retry after a
// transient Redis error) never refunds twice. Skips the refund entirely if
// the quota key has already expired (the account's billing cycle rolled over
// between reservation and settlement) — resurrecting it here would credit a
// cycle that no longer exists.
const SETTLE_SCRIPT = `
local quotaKey = KEYS[1]
local guardKey = KEYS[2]
local refundAmount = tonumber(ARGV[1])
local guardTtlSeconds = tonumber(ARGV[2])

local firstSettlement = redis.call('SET', guardKey, '1', 'NX', 'EX', guardTtlSeconds)
if not firstSettlement then
  return 0
end

if refundAmount > 0 and redis.call('EXISTS', quotaKey) == 1 then
  redis.call('INCRBYFLOAT', quotaKey, refundAmount)
end
return 1
`;

// Factory (not a bare module-scope singleton) so tests can point this at a
// disposable Redis connection — same pattern as routing-memory and the
// mcp-server quota/rate-limit modules.
export function createQuotaSettler(redisUrl: string) {
  const redis = new Redis(redisUrl);

  async function settleQuota(
    accountId: string,
    requestId: string,
    envelope: ResultEnvelope,
  ): Promise<void> {
    const actualCharge = chargeForEnvelope(envelope);
    const refundAmount = MAX_RESERVE_CHARGE - actualCharge;

    await redis.eval(
      SETTLE_SCRIPT,
      2,
      quotaKey(accountId),
      settlementGuardKey(requestId),
      refundAmount,
      SETTLEMENT_GUARD_TTL_S,
    );
  }

  async function close(): Promise<void> {
    await redis.quit();
  }

  return { settleQuota, close };
}

// Module-scope singleton — same convention as
// routing-memory/redis-routing-memory.ts's defaultRoutingMemory.
export const defaultQuotaSettler = createQuotaSettler(config.redisUrl);
