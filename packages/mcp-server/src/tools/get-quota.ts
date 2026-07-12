// get_quota is a read-only lookup, not a render — it does NOT enqueue a BullMQ
// job. See docs/rules/11-billing-and-quota.md for the charge policy this
// deliberately sits outside of.

import { getQuotaInputSchema, MONTHLY_QUOTA } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { accountsRepository } from '../db/accounts-repository.js';
import { getQuotaStatus } from '../quota/redis-quota.js';
import type { ToolRequestContext } from './view-page.js';

export async function handleGetQuota(rawArgs: unknown, ctx: ToolRequestContext): Promise<ResultEnvelope> {
  getQuotaInputSchema.parse(rawArgs);

  const [account, status] = await Promise.all([
    accountsRepository.findById(ctx.account.id),
    getQuotaStatus(ctx.account.id),
  ]);

  return {
    ok: true,
    meta: { requestId: ctx.requestId, rungReached: 0, durationMs: 0 },
    data: {
      remaining: status.remaining,
      monthlyQuota: MONTHLY_QUOTA,
      resetAt: account?.quotaResetAt ? account.quotaResetAt.toISOString() : null,
    },
  };
}
