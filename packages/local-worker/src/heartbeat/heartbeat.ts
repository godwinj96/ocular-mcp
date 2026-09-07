// The heartbeat: a periodic "I am here" from this machine to the cloud,
// independent of whether anything is being captured.
//
// WHY IT HAD TO EXIST. subscription/validate.ts already talks to the cloud on a
// 15-minute cached basis, and it is tempting to call that a heartbeat -- it was
// called one, in planning, before anyone checked. It isn't: isActive() is
// invoked from exactly one place, the capture path, so the cache only refreshes
// when a capture forces it. A worker installed on a running laptop that nobody
// has asked to look at anything is completely silent, and indistinguishable
// from one that was uninstalled last week.
//
// That distinction is the entire dashboard. "Idle" is the state Ocular's
// three-tier lifecycle is ENGINEERED to sit in -- browser shut down, supervisor
// only, ~10-15MB -- so idle has to read as healthy, and it cannot read as
// anything at all if the server never hears from us.
//
// THE COST, stated plainly because it is a real trade against the invisibility
// promise: an idle install now makes one small HTTPS request every five
// minutes, forever. That is ~288 requests a day carrying a uuid and three
// integers. It adds no window, no dock icon, no firewall prompt (outbound
// only), and no measurable CPU. It is a deliberate exchange of a little quiet
// network traffic for a dashboard that can tell the truth.
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { config } from '../config.js';

const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

// Captures completed since the last successful heartbeat. Counts only -- there
// is deliberately nowhere in this module to put a URL.
interface PendingCounts {
  local: number;
  cloud: number;
}

export interface HeartbeatDeps {
  /** Resolves the bearer credential; same one the cloud client uses. */
  getToken: () => Promise<string>;
  /** Stable per-machine id, persisted by the caller. */
  workerId: string;
  version: string;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
}

export class Heartbeat {
  private timer: NodeJS.Timeout | null = null;
  private pending: PendingCounts = { local: 0, cloud: 0 };

  constructor(private readonly deps: HeartbeatDeps) {}

  /** Called by the capture path. Cheap, synchronous, never throws. */
  countCapture(path: 'local' | 'cloud'): void {
    this.pending[path] += 1;
  }

  start(): void {
    if (this.timer) return;

    const interval = this.deps.intervalMs ?? HEARTBEAT_INTERVAL_MS;

    // unref() so a pending heartbeat never holds the process open. The
    // supervisor's lifetime is decided by the lifecycle manager, not by us --
    // a timer that kept the process alive would directly contradict the
    // "idle means shut down" tier.
    this.timer = setInterval(() => void this.send(), interval);
    this.timer.unref?.();

    // Report immediately as well, so a machine that was just installed appears
    // in the dashboard within seconds rather than after the first interval.
    void this.send();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async send(): Promise<void> {
    // Snapshot and clear BEFORE awaiting, then restore on failure. Reading the
    // counters after the await would drop any capture that completed while the
    // request was in flight.
    const sending = { ...this.pending };
    this.pending = { local: 0, cloud: 0 };

    try {
      const token = await this.deps.getToken();
      const doFetch = this.deps.fetchImpl ?? fetch;

      // Derived from the MCP endpoint rather than configured separately, so
      // there is one cloud address to point at a deployment, not two that
      // can disagree.
      const endpoint = new URL('/worker/heartbeat', config.cloudMcpUrl);

      const response = await doFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: this.deps.workerId,
          label: hostname(),
          version: this.deps.version,
          platform: process.platform,
          localCaptures: sending.local,
          cloudCaptures: sending.cloud,
        }),
      });

      if (!response.ok) {
        this.restore(sending);
      }
    } catch {
      // Offline, asleep, or the server is down. A heartbeat is advisory: the
      // product keeps working locally regardless, so there is nothing to
      // surface to the user and nothing to retry beyond the next tick. The
      // counts go back so they land with the heartbeat that does get through.
      this.restore(sending);
    }
  }

  private restore(counts: PendingCounts): void {
    this.pending.local += counts.local;
    this.pending.cloud += counts.cloud;
  }
}

/** A fresh opaque worker id. Persisted by the caller; not derived from hardware. */
export function newWorkerId(): string {
  return randomUUID();
}
