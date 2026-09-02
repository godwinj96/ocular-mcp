// Read-only Redis quota peek — mirrors packages/mcp-server/src/quota/redis-quota.ts's
// getQuotaStatus exactly (same key shape `quota:${accountId}`, same "missing
// key = full plan-tier dailyQuota" semantics). Duplicated deliberately, not
// cross-imported, per docs/rules/02-repo-structure.md's package-boundary
// rule. Never reserves/decrements — this package never touches the render
// pipeline or BullMQ queue.
//
// ⚠️ This is the CLOUD path's quota only — local-worker renders are
// unmetered (docs/rules/11-billing-and-quota.md §0a). Don't let this page
// imply the user's overall Ocular usage is capped.
import { Redis } from 'ioredis';
import { DAILY_CLOUD_QUOTA_BY_TIER, tierOfPlanSlug } from '@ocular/shared';

if (!process.env.REDIS_URL) {
  throw new Error('Missing required env var: REDIS_URL. Check your .env file.');
}

let client: Redis | null = null;
function getClient(): Redis {
  client ??= new Redis(process.env.REDIS_URL!);
  return client;
}

function quotaKey(accountId: string): string {
  return `quota:${accountId}`;
}

export interface QuotaStatus {
  remaining: number;
  dailyQuota: number;
}

export async function getQuotaStatus(accountId: string, plan: string | null): Promise<QuotaStatus> {
  const dailyQuota = DAILY_CLOUD_QUOTA_BY_TIER[tierOfPlanSlug(plan) ?? 'basic'];
  const raw = await getClient().get(quotaKey(accountId));
  return {
    remaining: raw === null ? dailyQuota : Number(raw),
    dailyQuota,
  };
}
