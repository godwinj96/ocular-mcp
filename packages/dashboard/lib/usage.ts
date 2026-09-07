// Capture counts, and the reason the dashboard leads with a total rather than
// with an allowance.
//
// The old quota page rendered "{remaining} / {dailyQuota} left today". For the
// overwhelming majority of Basic users — whose entire workload is localhost,
// which is the whole point of the product — that reads "40 / 40 left today",
// every day, forever. Two readings, both bad: "I've used nothing, why am I
// paying" (the renewal-moment churn mechanism), or "I have a cap of 40" (wrong
// model, and it would make someone ration a resource that costs them nothing).
//
// Leading with the total, split local/web, fixes both. It is also the only
// number that makes $2.50 feel cheap rather than unused.
//
// Counts only. Never a target, never a timestamp per capture — see
// infra/postgres/migrations/0002 for the boundary and why it is drawn there.
import { sql } from './postgres';

export interface DayCount {
  day: string; // ISO date, UTC
  local: number;
  cloud: number;
}

export interface UsageSummary {
  monthLocal: number;
  monthCloud: number;
  monthTotal: number;
  /** True once a web capture has EVER been made -- gates the allowance block. */
  hasEverUsedCloud: boolean;
  recent: DayCount[];
}

interface CountRow {
  day: string;
  local_count: number;
  cloud_count: number;
}

export async function getUsage(accountId: string, days = 7): Promise<UsageSummary> {
  const rows = (await sql`
    select day::text as day, local_count, cloud_count
    from capture_counters
    where account_id = ${accountId}
      and day >= date_trunc('month', now() at time zone 'utc')::date
    order by day desc
  `) as CountRow[];

  const monthLocal = rows.reduce((sum, r) => sum + r.local_count, 0);
  const monthCloud = rows.reduce((sum, r) => sum + r.cloud_count, 0);

  // "Ever", not "this month": a user who made web captures in August and none
  // in September should still see the allowance block, because they already
  // have a mental model for it and its disappearance would be confusing.
  const everRows = (await sql`
    select 1 from capture_counters
    where account_id = ${accountId} and cloud_count > 0
    limit 1
  `) as unknown[];

  return {
    monthLocal,
    monthCloud,
    monthTotal: monthLocal + monthCloud,
    hasEverUsedCloud: everRows.length > 0,
    recent: rows.slice(0, days).map((r) => ({
      day: r.day,
      local: r.local_count,
      cloud: r.cloud_count,
    })),
  };
}
