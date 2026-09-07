// Worker liveness — read AND write. This package is the only writer of the
// `workers` and `capture_counters` tables (see recordHeartbeat below and
// app/api/internal/worker-heartbeat/route.ts) as well as the reader behind
// the dashboard's headline block, per docs/rules/02-repo-structure.md §0.6.
//
// WHAT THIS FILE MUST NOT STORE, same boundary as the route that calls it: an
// opaque client-generated worker id, a hostname label, a version, a platform,
// and integer capture counts. Never a URL, never a page title, never a
// per-capture timestamp — see CLAUDE.md's exfiltration-surface boundary.
//
// WHAT "CONNECTED" ACTUALLY MEANS, because it is easy to overstate. Two
// different signals land in this table:
//
//   last_seen_at  — updated whenever the worker talks to the cloud at all,
//                   which historically only happened when a capture forced a
//                   subscription revalidation. Capture-driven, so it means
//                   "last did some work", NOT "is alive".
//   heartbeat_at  — a real timer tick from the supervisor, independent of
//                   captures. This is the one that can distinguish an idle
//                   worker on a running laptop from one that was uninstalled
//                   last week. Before it existed, both were simply silent.
//
// The state machine below reads heartbeat_at when it has one and degrades
// gracefully to last_seen_at when it does not, so a worker on an older build
// still reports something honest rather than being declared offline.
import { sql } from './postgres';

// Two missed heartbeats plus slack. Tight enough that "offline" means offline;
// loose enough that one dropped request, a sleeping laptop lid, or a slow
// network does not flip a healthy worker to a fault state.
const HEARTBEAT_INTERVAL_MIN = 5;
const OFFLINE_AFTER_MIN = HEARTBEAT_INTERVAL_MIN * 2 + 2;

// Past this, "offline" stops being useful and "quiet" is the honest word. A
// closed laptop is the common cause and nothing is wrong.
const QUIET_AFTER_DAYS = 7;

export type WorkerState = 'connected' | 'offline' | 'quiet';

export interface Worker {
  id: string;
  workerId: string;
  label: string | null;
  version: string | null;
  platform: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  heartbeatAt: string | null;
  state: WorkerState;
}

interface WorkerRow {
  id: string;
  worker_id: string;
  label: string | null;
  version: string | null;
  platform: string | null;
  first_seen_at: string;
  last_seen_at: string;
  heartbeat_at: string | null;
}

export function workerState(row: { lastSeenAt: string; heartbeatAt: string | null }): WorkerState {
  const latest = row.heartbeatAt ?? row.lastSeenAt;
  const ageMs = Date.now() - new Date(latest).getTime();

  if (ageMs <= OFFLINE_AFTER_MIN * 60_000) return 'connected';
  if (ageMs >= QUIET_AFTER_DAYS * 24 * 60 * 60_000) return 'quiet';
  return 'offline';
}

function toWorker(row: WorkerRow): Worker {
  const partial = {
    lastSeenAt: row.last_seen_at,
    heartbeatAt: row.heartbeat_at,
  };
  return {
    id: row.id,
    workerId: row.worker_id,
    label: row.label,
    version: row.version,
    platform: row.platform,
    firstSeenAt: row.first_seen_at,
    ...partial,
    state: workerState(partial),
  };
}

export async function listWorkers(accountId: string): Promise<Worker[]> {
  const rows = (await sql`
    select id, worker_id, label, version, platform, first_seen_at, last_seen_at, heartbeat_at
    from workers
    where account_id = ${accountId}
    order by coalesce(heartbeat_at, last_seen_at) desc
  `) as WorkerRow[];

  return rows.map(toWorker);
}

// The write side. Moved here from mcp-server/src/db/workers.ts — this table
// (and capture_counters, and the worker.connected audit line) now has exactly
// one writer, reached only via app/api/internal/worker-heartbeat/route.ts.
// See docs/rules/02-repo-structure.md §0.6.
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
  const rows = (await sql`
    insert into workers (account_id, worker_id, label, version, platform, heartbeat_at, last_seen_at)
    values (${input.accountId}, ${input.workerId}, ${input.label}, ${input.version}, ${input.platform}, now(), now())
    on conflict (account_id, worker_id) do update
      set heartbeat_at = now(),
          last_seen_at = now(),
          label    = coalesce(excluded.label, workers.label),
          version  = coalesce(excluded.version, workers.version),
          platform = coalesce(excluded.platform, workers.platform)
    returning (xmax = 0) as inserted
  `) as { inserted: boolean }[];

  const local = Math.max(0, Math.trunc(input.localCaptures ?? 0));
  const cloud = Math.max(0, Math.trunc(input.cloudCaptures ?? 0));

  if (local > 0 || cloud > 0) {
    // The day boundary is UTC, matching the Redis quota counter's reset — see
    // @ocular/shared's quota.ts — so a row here and the enforcement counter
    // never disagree about which day it is.
    await sql`
      insert into capture_counters (account_id, day, local_count, cloud_count)
      values (${input.accountId}, (now() at time zone 'utc')::date, ${local}, ${cloud})
      on conflict (account_id, day) do update
        set local_count = capture_counters.local_count + excluded.local_count,
            cloud_count = capture_counters.cloud_count + excluded.cloud_count
    `;
  }

  return { firstSeen: rows[0]?.inserted ?? false };
}
