// Reports a worker heartbeat to the dashboard, which owns the `workers`,
// `capture_counters`, and `audit_events` tables — see
// docs/rules/02-repo-structure.md §0.6. mcp-server's only job here is what it
// was already doing for every other call: verify the caller's bearer token.
// It never touches Postgres for this data anymore (db/workers.ts is gone).
//
// This is NOT the render path. A heartbeat is a background timer tick from
// the supervisor every 5 minutes (packages/local-worker/src/heartbeat/heartbeat.ts),
// never something a customer is waiting on — so a Vercel cold start here costs
// nothing a user would notice, unlike the quota check, which stays hot and
// in-process for exactly that reason (see redis-quota.ts and
// docs/rules/02-repo-structure.md §0.6's enforcement-vs-ownership split).
//
// Authenticated with a static service secret, not the caller's own bearer —
// the dashboard's internal route trusts mcp-server, not the end user's token
// a second time; mcp-server already did that verification once.
import type { HeartbeatBody } from '@ocular/shared';
import { config } from '../config.js';

export interface DashboardHeartbeatResult {
  ok: boolean;
}

export async function reportHeartbeatToDashboard(
  accountId: string,
  body: HeartbeatBody,
): Promise<DashboardHeartbeatResult> {
  const endpoint = new URL('/api/internal/worker-heartbeat', config.dashboardInternalUrl);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.internalServiceSecret}`,
      },
      body: JSON.stringify({ accountId, ...body }),
    });

    return { ok: response.ok };
  } catch {
    // The dashboard being briefly unreachable must never fail the heartbeat
    // response to the local worker — see heartbeat.ts's own retry/restore
    // logic, which already treats a non-ok response as advisory and retries
    // on the next tick.
    return { ok: false };
  }
}
