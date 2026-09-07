// The cloud quota READ contract — key shape and "missing key" semantics.
// Single definition for a fact two packages need: mcp-server's redis-quota.ts
// (which also owns the write/reserve side, kept there because it's the
// render-path enforcement code and has to stay next to the Redis client it's
// already holding open) and the dashboard's usage surface, which reports the
// same number back to the account owner. See docs/rules/02-repo-structure.md
// §0.6 — this is exactly the "contract, not I/O" split that section asks for:
// each caller supplies its own Redis client, but neither re-derives what a
// missing key means or how the key is built.
//
// Enforcement (checkAndReserveQuota, the atomic Lua reserve) is deliberately
// NOT here — see docs/rules/11-billing-and-quota.md §2. It only ever runs in
// the cloud render path, in-process against a Redis client mcp-server already
// holds open, and moving it behind any network hop (including this package
// crossing into a Vercel deployment) would put latency in front of every paid
// capture for no ownership benefit — the write side was never duplicated.

/** The minimal surface this needs from a Redis client — never the whole `ioredis.Redis` type, so `shared` doesn't have to depend on `ioredis` just to describe a `.get()` call. */
export interface QuotaPeekClient {
  get(key: string): Promise<string | null>;
}

export function quotaKey(accountId: string): string {
  return `quota:${accountId}`;
}

export interface QuotaStatus {
  remaining: number;
}

// A missing key means the account hasn't made a chargeable cloud call yet
// today, so its full plan-tier dailyQuota is still available — matches the
// enforcement side's own "no key yet" initialization value in redis-quota.ts.
// Read-only: never reserves/decrements.
export function createQuotaReader(client: QuotaPeekClient) {
  return async function getQuotaStatus(
    accountId: string,
    dailyQuota: number,
  ): Promise<QuotaStatus> {
    const raw = await client.get(quotaKey(accountId));
    return { remaining: raw === null ? dailyQuota : Number(raw) };
  };
}
