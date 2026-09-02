/**
 * Starting configuration constants — tune, don't trust.
 * Source of truth: docs/rules/08-performance.md §0. A PR that changes one of
 * these values updates that table in the same diff.
 */

export const RENDER_CONCURRENCY = 4;
export const QUEUE_CONCURRENCY = 8;

export const JOB_DEADLINE_MS = 10_000;
export const SERVER_AWAIT_MS = 12_000;

export const BROWSER_RECYCLE_REQUESTS = 300;
export const BROWSER_RECYCLE_MINUTES = 30;

export const IMG_MAX_EDGE_PX = 1568;
export const IMG_WEBP_QUALITY = 75;
export const IMG_MAX_KB = 200;

/** detail knob -> max long-edge px, per docs/rules/05-worker-and-browser-pipeline.md §5 */
export const DETAIL_MAX_EDGE_PX = {
  low: 768,
  balanced: IMG_MAX_EDGE_PX,
  high: 2000,
} as const satisfies Record<'low' | 'balanced' | 'high', number>;

export const MAX_ESCALATIONS = 2;
export const MAX_REDIRECT_HOPS = 5;

// Cloud-path daily render cap is now plan-tier-dependent (Basic/Pro) — see
// plans.ts's DAILY_CLOUD_QUOTA_BY_TIER. The old flat DAILY_CLOUD_QUOTA
// constant was removed 2026-09-01 (Session 26) when the single-plan model
// was replaced; nothing in this codebase should hardcode one daily cap for
// every account again.

export const SUCCESS_CHARGE = 1.0;
export const EXHAUSTED_FAILURE_CHARGE = 0.5;

/**
 * Per-rung charge multiplier against the daily cloud cap — an escalated
 * render costs more than a clean rung-0 render because it consumed more
 * real proxy/compute. docs/rules/11-billing-and-quota.md §0b.
 *
 * PROVISIONAL. Rung 1's ~3x is the PRD's own worked example; rungs 2/3 are
 * placeholders pending real M3 vendor cost data (Camoufox/Decodo aren't
 * provisioned yet) — do not treat 5/8 as final.
 */
export const RUNG_CHARGE_MULTIPLIERS = {
  0: 1,
  1: 3,
  2: 5, // PROVISIONAL — pending M3 vendor cost data
  3: 8, // PROVISIONAL — pending M3 vendor cost data
} as const satisfies Record<number, number>;

/**
 * Local worker subscription-validity check is cached, not a live round-trip
 * per capture (docs/rules/13-local-worker-and-distribution.md §6). This is
 * how long a cached "active" result is trusted while the validation server
 * is unreachable (e.g. offline) before the local worker refuses to render.
 *
 * PROVISIONAL — no value was specified anywhere in PRD v0.2; 72h was chosen
 * to cover a long weekend/flight without becoming effectively-unlimited free
 * use. Revisit once real usage data exists.
 */
export const LOCAL_SUBSCRIPTION_GRACE_HOURS = 72;

/**
 * How often the local worker re-checks subscription validity against the
 * server while online (a cached result younger than this is reused without
 * a network round-trip). Distinct from LOCAL_SUBSCRIPTION_GRACE_HOURS above,
 * which governs how long a cached result stays trusted while *offline*.
 *
 * PROVISIONAL — not specified in PRD v0.2 or docs/rules/13-local-worker-and-distribution.md
 * §6 beyond "cached, periodically-refreshed"; 15 minutes balances catching a
 * cancellation reasonably promptly against not hammering the cloud API on
 * every capture.
 */
export const LOCAL_SUBSCRIPTION_REFRESH_MIN = 15;

/**
 * Local worker idle-shutdown threshold — no activity for this long fully
 * terminates the browser (never pauses/suspends a zero-context browser),
 * dropping the supervisor to its ~10-15MB idle footprint.
 * docs/rules/13-local-worker-and-distribution.md §3.
 */
export const LOCAL_IDLE_SHUTDOWN_MIN = 30;

/**
 * Two-tier cache TTL, by target volatility. docs/rules/05-worker-and-browser-pipeline.md
 * §5a / docs/rules/13-local-worker-and-distribution.md §7 — both cloud and
 * local caches honour the same fresh:true bypass and variable-TTL contract.
 *
 * PROVISIONAL 3-tier default pending real usage data; not domain-classified
 * yet (every target currently uses CACHE_TTL_STANDARD_S until a volatility
 * heuristic is built).
 */
export const CACHE_TTL_VOLATILE_S = 5 * 60;
export const CACHE_TTL_STANDARD_S = 60 * 60;
export const CACHE_TTL_STABLE_S = 24 * 60 * 60;

/**
 * Per-account/per-key short-window rate limit, independent of monthly quota —
 * the backstop for the half-charge-on-failure billing policy (see
 * docs/rules/07-security.md §4 and docs/rules/11-billing-and-quota.md §0).
 */
export const RATE_LIMIT_WINDOW_S = 60;
export const RATE_LIMIT_MAX_REQUESTS = 20;

export const DAILY_PAID_BUDGET_USD = 5;

export const JWKS_CACHE_TTL_S = 600;

/** BullMQ queue name shared by mcp-server (producer) and worker (consumer). */
export const RENDER_QUEUE_NAME = 'ocular-render';
