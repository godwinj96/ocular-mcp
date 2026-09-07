// Worker liveness and capture counters — the durable record behind the
// dashboard's "is it running?" block.
//
// WHY AN HTTP ENDPOINT AND NOT AN MCP TOOL. Every MCP tool this server
// registers is visible in the calling agent's tool list, and a `heartbeat` tool
// would be both meaningless and distracting there — an agent has no reason to
// call it and no way to use the result. The supervisor posts to a plain route
// with the same bearer credential instead.
//
// WHAT IT STORES, and the boundary this file must not cross: an opaque
// client-generated worker id, a hostname label, a version, a platform, and
// integer capture counts. Never a URL, never a page title, never a per-capture
// timestamp. Local captures include localhost and (phase 2) authenticated
// pages; a record of those on our servers is precisely the exfiltration surface
// CLAUDE.md's threat model rules out.
import { pool } from './pool.js';

export interface HeartbeatInput {
  accountId: string;
  workerId: string;
  label: string | null;
  version: string | null;
  platform: string | null;
  /** Captures completed since the last heartbeat, by path. Counts only. */
  localCaptures?: number;
  cloudCaptures?: number;
}

export async function recordHeartbeat(input: HeartbeatInput): Promise<{ firstSeen: boolean }> {
  const { rows } = await pool.query<{ inserted: boolean }>(
    `insert into workers (account_id, worker_id, label, version, platform, heartbeat_at, last_seen_at)
     values ($1, $2, $3, $4, $5, now(), now())
     on conflict (account_id, worker_id) do update
       set heartbeat_at = now(),
           last_seen_at = now(),
           label    = coalesce(excluded.label, workers.label),
           version  = coalesce(excluded.version, workers.version),
           platform = coalesce(excluded.platform, workers.platform)
     returning (xmax = 0) as inserted`,
    [input.accountId, input.workerId, input.label, input.version, input.platform],
  );

  const local = Math.max(0, Math.trunc(input.localCaptures ?? 0));
  const cloud = Math.max(0, Math.trunc(input.cloudCaptures ?? 0));

  if (local > 0 || cloud > 0) {
    // The day boundary is UTC, matching the allowance reset — so a row here
    // and the Redis quota counter never disagree about which day it is.
    await pool.query(
      `insert into capture_counters (account_id, day, local_count, cloud_count)
       values ($1, (now() at time zone 'utc')::date, $2, $3)
       on conflict (account_id, day) do update
         set local_count = capture_counters.local_count + excluded.local_count,
             cloud_count = capture_counters.cloud_count + excluded.cloud_count`,
      [input.accountId, local, cloud],
    );
  }

  return { firstSeen: rows[0]?.inserted ?? false };
}

export async function recordWorkerConnected(
  accountId: string,
  label: string | null,
): Promise<void> {
  await pool.query(
    `insert into audit_events (account_id, kind, detail, actor)
     values ($1, 'worker.connected', $2::jsonb, 'worker')`,
    [accountId, JSON.stringify(label ? { label } : {})],
  );
}
