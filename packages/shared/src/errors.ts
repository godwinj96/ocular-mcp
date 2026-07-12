import { z } from 'zod';

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
