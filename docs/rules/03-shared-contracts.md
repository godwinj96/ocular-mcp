# Ocular — Shared Contract Rules

**Section 3 of 12 · Always Apply**

> This is the single most important file in the ruleset. `mcp-server` and `worker` are separate deployables; the _only_ thing keeping them in sync is `packages/shared`. Define this before writing any tool handler or extractor.

---

## 0. Guiding principle

**Nothing crosses the `mcp-server` ↔ `worker` boundary (via BullMQ job payload or return value) without a Zod schema in `shared`.** Not "will add types later" — the schema is the type. `z.infer<>` derives the TypeScript type from it, never the reverse.

---

## 1. Result envelope

```typescript
// packages/shared/src/errors.ts
import { z } from 'zod';

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
  meta: { requestId: string; rungReached: number; durationMs: number; [k: string]: unknown };
  image?: { b64: string; mime: 'image/webp'; w: number; h: number; bytes: number };
  data?: TData;
}

export interface FailureEnvelope {
  ok: false;
  reason: ErrorCode;
  message: string;
  rungReached: number;
  partial?: Record<string, unknown>;
}

export type ResultEnvelope<TData = unknown> = SuccessEnvelope<TData> | FailureEnvelope;
```

**Rules:**

- `ErrorCode` is a closed enum. Adding a new value requires updating this file, the MCP error-mapping code in `mcp-server/src/mcp/to-content-blocks.ts`, and `09-error-handling-and-logging.md`'s table in the same PR.
- `message` is always a human-safe string. Never interpolate a raw stack trace, SQL error, or internal file path into `message` — see `09-error-handling-and-logging.md` §2.
- `worker` is the only producer of envelopes. `mcp-server` only ever _maps_ an envelope to MCP content blocks — it never constructs one from scratch except for pre-enqueue rejections (`SSRF_BLOCKED`, `QUOTA_EXCEEDED`, `UNAUTHORIZED`, `INVALID_URL`), which follow the exact same `FailureEnvelope` shape.

---

## 2. Tool schemas — one file per tool

```typescript
// packages/shared/src/schemas/view-page.schema.ts
export const viewPageInputSchema = z.object({
  url: z.string().url(),
  detail: z.enum(['low', 'balanced', 'high']).default('balanced'),
  full_page: z.boolean().default(false),
  viewport: z
    .object({ w: z.number().int().min(200).max(3840), h: z.number().int().min(200).max(2160) })
    .optional(),
});
export type ViewPageInput = z.infer<typeof viewPageInputSchema>;

// packages/shared/src/schemas/inspect-ui.schema.ts
export const inspectUiInputSchema = viewPageInputSchema.omit({ full_page: true });
export type InspectUiInput = z.infer<typeof inspectUiInputSchema>;

// packages/shared/src/schemas/extract-assets.schema.ts
export const extractAssetsInputSchema = z.object({
  url: z.string().url(),
  include: z.array(z.enum(['svg', 'img', 'icons'])).default(['svg', 'img', 'icons']),
});
export type ExtractAssetsInput = z.infer<typeof extractAssetsInputSchema>;

// packages/shared/src/schemas/get-quota.schema.ts
export const getQuotaInputSchema = z.object({}); // no args, kept as a schema for consistency
```

**Rule:** every schema uses `.url()` for URL fields, never a bare `z.string()` — this is the first SSRF defense layer (rejects non-URL-shaped input before it reaches the SSRF pre-check). Numeric bounds (viewport, etc.) are enforced in the schema, not re-validated ad hoc downstream.

---

## 3. Job payload

```typescript
// packages/shared/src/job.ts
export interface OcularJob<TInput = unknown> {
  tool: 'view_page' | 'inspect_ui' | 'extract_assets' | 'get_quota';
  args: TInput; // already Zod-validated by mcp-server before enqueue
  account: { id: string; plan: string };
  requestId: string; // uuid, used for tracing across both services' logs
  deadlineMs: number; // Date.now() + JOB_DEADLINE_MS at enqueue time — NOT a duration
}
```

`deadlineMs` is an absolute timestamp, not a countdown, precisely so that time spent in the BullMQ queue before pickup is charged against the same budget the worker uses — see `08-performance.md` §1.

---

## 4. Versioning and change discipline

- Adding an **optional** field to a schema (with a `.default()` or `.optional()`) is backward compatible — do it freely.
- Removing a field, tightening a constraint, or making an optional field required is a **breaking change**. Since `mcp-server` and `worker` deploy independently, a breaking change requires a two-step rollout: add the new shape alongside the old, deploy both services, remove the old shape in a follow-up change. Document the rollout in `DEVLOG.md`.
- Never reuse an `ErrorCode` value for a different meaning than documented in §1.

---

## 5. What never lives in `shared`

- Anything that imports `patchright`, `ioredis`, `bullmq`, `@modelcontextprotocol/sdk`, or `fastify`. `shared` has effectively zero runtime dependencies beyond `zod`.
- Environment variable reads (`process.env.*`) — `shared` exports constants and schemas, not config. Config loading lives in each package (see `12-environment-and-secrets.md`).
- Anything that only one of the two services needs. If only `worker` uses a type, it lives in `worker/src/`.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
