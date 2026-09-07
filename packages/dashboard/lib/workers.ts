// Worker liveness — the data behind the dashboard's headline block.
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
