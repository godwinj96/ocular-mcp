// Cached, periodically-refreshed subscription validity check. See
// docs/rules/13-local-worker-and-distribution.md §6: local rendering is
// unlimited but must be authenticated — "unlimited does not mean
// unauthenticated" — validated on a cached basis, never a live round-trip
// per capture, with an explicit, bounded offline-grace window.
//
// Reuses get_quota as the validity signal rather than inventing a new
// backend endpoint: get_quota's auth pipeline already fails closed on an
// inactive/unknown account (docs/rules/11-billing-and-quota.md §3 — "AuthKit
// user with no matching Postgres row -> UNAUTHORIZED, never default free
// tier"), so a successful get_quota call *is* proof of an active
// subscription, and a definitive auth failure *is* proof it's not — no new
// server-side work needed for Phase 2.

import { LOCAL_SUBSCRIPTION_GRACE_HOURS, LOCAL_SUBSCRIPTION_REFRESH_MIN } from '@ocular/shared';
import { connectCloudClient, NoApiKeyError } from '../http/cloud-client.js';

export interface SubscriptionStatus {
  active: boolean;
  /** True when this result came from cache under the offline-grace window, not a fresh check. */
  fromOfflineGrace: boolean;
}

// Distinguishes "the server gave a definitive answer" (trust it, cache it,
// never grace-extend a definitive "no") from "we couldn't reach the server
// at all" (offline — the grace window applies).
export type CheckOutcome = { kind: 'definitive'; active: boolean } | { kind: 'network_error' };

export type CheckFn = () => Promise<CheckOutcome>;

interface CacheEntry {
  active: boolean;
  checkedAt: number;
  /** True once a check has actually succeeded at least once — an entry seeded only by a network error never grants grace. */
  everConfirmed: boolean;
}

export interface Clock {
  now(): number;
}

const realClock: Clock = { now: () => Date.now() };

export class SubscriptionValidator {
  private cache: CacheEntry | null = null;

  constructor(
    private readonly check: CheckFn,
    private readonly clock: Clock = realClock,
    private readonly refreshMs: number = LOCAL_SUBSCRIPTION_REFRESH_MIN * 60_000,
    private readonly graceMs: number = LOCAL_SUBSCRIPTION_GRACE_HOURS * 60 * 60_000,
  ) {}

  async isActive(): Promise<SubscriptionStatus> {
    const now = this.clock.now();

    if (this.cache && now - this.cache.checkedAt < this.refreshMs) {
      return { active: this.cache.active, fromOfflineGrace: false };
    }

    const outcome = await this.check();

    if (outcome.kind === 'definitive') {
      this.cache = { active: outcome.active, checkedAt: now, everConfirmed: true };
      return { active: outcome.active, fromOfflineGrace: false };
    }

    // Network error — fall back to a still-fresh cached result if one
    // exists and is within the (much longer) offline-grace window. A cache
    // entry that has never been definitively confirmed can't grant grace —
    // that would mean an account that failed its very first check gets
    // treated as active by default, which is exactly the "never a default
    // free tier" rule this file exists to uphold.
    if (this.cache?.everConfirmed && now - this.cache.checkedAt < this.graceMs) {
      return { active: this.cache.active, fromOfflineGrace: true };
    }

    // No usable cache and the network is unreachable — fail closed.
    return { active: false, fromOfflineGrace: false };
  }
}

// Real CheckFn — calls get_quota against the cloud mcp-server. A definitive
// UNAUTHORIZED (or any MCP tool error) means the account is not active
// right now; anything that isn't even a definitive answer (DNS failure,
// connection refused, timeout — the "offline" case) reports network_error
// so SubscriptionValidator can apply the grace window instead of treating a
// dropped wifi connection as a cancellation.
export function createCloudSubscriptionCheck(): CheckFn {
  return async () => {
    if (!process.env.OCULAR_API_KEY) {
      // No key configured at all isn't "offline" — it's a configuration
      // state with a definitive answer: not active.
      return { kind: 'definitive', active: false };
    }

    let client;
    try {
      client = await connectCloudClient();
    } catch (error) {
      if (error instanceof NoApiKeyError) {
        return { kind: 'definitive', active: false };
      }
      return { kind: 'network_error' };
    }

    try {
      const result = await client.callTool('get_quota', {});
      return { kind: 'definitive', active: !result.isError };
    } catch {
      // Connected but the call itself failed to complete — treat as offline
      // rather than definitive, since a connection that drops mid-request
      // is a network condition, not an auth answer.
      return { kind: 'network_error' };
    } finally {
      await client.close().catch(() => undefined);
    }
  };
}
