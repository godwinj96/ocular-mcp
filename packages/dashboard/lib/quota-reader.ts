// Read-only Redis quota peek. The key shape and "missing key = full
// dailyQuota" semantics are @ocular/shared's quota.ts — the single
// definition mcp-server's redis-quota.ts also builds on — so this file only
// supplies the dashboard's own Redis client. See
// docs/rules/02-repo-structure.md §0.6: enforcement (reserve/decrement) stays
// in mcp-server's process because it's on the render-path hot path; the
// dashboard owns the read/report surface everything else reads from.
//
// ⚠️ This is the CLOUD path's quota only — local-worker renders are
// unmetered (docs/rules/11-billing-and-quota.md §0a). Don't let this page
// imply the user's overall Ocular usage is capped.
import { Redis } from 'ioredis';
import { DAILY_CLOUD_QUOTA_BY_TIER, createQuotaReader, tierOfPlanSlug } from '@ocular/shared';

if (!process.env.REDIS_URL) {
  throw new Error('Missing required env var: REDIS_URL. Check your .env file.');
}

let client: Redis | null = null;
let readQuota: ReturnType<typeof createQuotaReader> | null = null;
function getReader(): ReturnType<typeof createQuotaReader> {
  client ??= new Redis(process.env.REDIS_URL!);
  readQuota ??= createQuotaReader(client);
  return readQuota;
}

export interface QuotaStatus {
  remaining: number;
  dailyQuota: number;
}

export async function getQuotaStatus(accountId: string, plan: string | null): Promise<QuotaStatus> {
  const dailyQuota = DAILY_CLOUD_QUOTA_BY_TIER[tierOfPlanSlug(plan) ?? 'basic'];
  const { remaining } = await getReader()(accountId, dailyQuota);
  return { remaining, dailyQuota };
}
