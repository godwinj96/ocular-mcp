// Read-only Redis quota peek — mirrors packages/mcp-server/src/quota/redis-quota.ts's
// getQuotaStatus exactly (same key shape `quota:${accountId}`, same "missing
// key = full MONTHLY_QUOTA" semantics). Duplicated deliberately, not
// cross-imported, per docs/rules/02-repo-structure.md's package-boundary
// rule. Never reserves/decrements — this package never touches the render
// pipeline or BullMQ queue.
import { Redis } from 'ioredis';

const MONTHLY_QUOTA = 300; // packages/shared/src/constants.ts's MONTHLY_QUOTA — not importable
// here (shared is zero-runtime-dependency and dashboard doesn't depend on
// @ocular/shared), so mirrored as a literal with a pointer back to the
// source of truth, same as the key-shape duplication above.

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
  monthlyQuota: number;
}

export async function getQuotaStatus(accountId: string): Promise<QuotaStatus> {
  const raw = await getClient().get(quotaKey(accountId));
  return {
    remaining: raw === null ? MONTHLY_QUOTA : Number(raw),
    monthlyQuota: MONTHLY_QUOTA,
  };
}
