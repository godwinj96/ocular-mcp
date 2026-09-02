// get_quota is a read-only lookup, not a render — it does NOT enqueue a BullMQ
// job. See docs/rules/11-billing-and-quota.md for the charge policy this
// deliberately sits outside of.
//
// This tool reports the CLOUD path's quota only. Local-worker renders are
// unmetered (docs/rules/11-billing-and-quota.md §0a) — the response makes
// that explicit via `path`/`note` so an agent seeing a low cloud count
// doesn't conclude its local dev-loop captures are about to stop working
// (docs/rules/11-billing-and-quota.md §1).

import { getQuotaInputSchema, DAILY_CLOUD_QUOTA_BY_TIER, tierOfPlanSlug } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { getQuotaStatus } from '../quota/redis-quota.js';
import type { ToolRequestContext } from './view-page.js';

export async function handleGetQuota(
  rawArgs: unknown,
  ctx: ToolRequestContext,
): Promise<ResultEnvelope> {
  getQuotaInputSchema.parse(rawArgs);

  const dailyQuota = DAILY_CLOUD_QUOTA_BY_TIER[tierOfPlanSlug(ctx.account.plan) ?? 'basic'];
  const status = await getQuotaStatus(ctx.account.id, dailyQuota);

  return {
    ok: true,
    meta: { requestId: ctx.requestId, rungReached: 0, durationMs: 0 },
    data: {
      path: 'cloud',
      remaining: status.remaining,
      dailyQuota,
      note: 'Cloud-render quota only, resets daily. Local-worker captures (localhost, your own dev server) are unmetered and unaffected by this number.',
    },
  };
}
