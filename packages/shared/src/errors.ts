import { z } from 'zod';
import type { A11yTree } from './schemas/a11y-tree.schema.js';

/**
 * Closed set of failure reasons. See docs/rules/09-error-handling-and-logging.md §1
 * for the full when/charge table. Adding a value requires updating that table,
 * docs/rules/03-shared-contracts.md §1, and the MCP error-mapping code in the
 * same PR.
 */
export const errorCodeSchema = z.enum([
  'BLOCKED',
  'TIMEOUT',
  'INVALID_URL',
  'SSRF_BLOCKED',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'UPSTREAM_4XX',
  'UPSTREAM_5XX',
  'RENDER_ERROR',
  'BUDGET_EXHAUSTED',
  'UNAUTHORIZED',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export interface SuccessEnvelope<TData = unknown> {
  ok: true;
  meta: {
    requestId: string;
    rungReached: number;
    durationMs: number;
    [key: string]: unknown;
  };
  image?: {
    b64: string;
    mime: 'image/webp';
    w: number;
    h: number;
    bytes: number;
  };
  /**
   * Shipped alongside every screenshot (view_page, both paths) — see
   * docs/rules/05-worker-and-browser-pipeline.md §4a. Never gated behind a
   * request flag: "annotate, never filter" applies to whether nodes are
   * included, not to whether the tree is sent at all.
   */
  a11yTree?: A11yTree;
  data?: TData;
}

export interface FailureEnvelope {
  ok: false;
  reason: ErrorCode;
  /** Human-safe message only — never a stack trace, SQL error, or raw upstream body. See 09-error-handling-and-logging.md §2. */
  message: string;
  rungReached: number;
  partial?: Record<string, unknown>;
}

export type ResultEnvelope<TData = unknown> = SuccessEnvelope<TData> | FailureEnvelope;
