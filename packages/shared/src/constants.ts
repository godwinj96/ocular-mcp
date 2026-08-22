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

export const MONTHLY_QUOTA = 300;
export const SUCCESS_CHARGE = 1.0;
export const EXHAUSTED_FAILURE_CHARGE = 0.5;

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
