# Ocular — Error Handling & Logging Rules

**Section 9 of 13 · Always Apply**

---

## 0. Guiding principle

Every failure has exactly one of the closed `ErrorCode` values from `03-shared-contracts.md` §1. No `try/catch` swallows an error into a generic 500 or a silent `undefined` — every code path that can fail resolves to a `FailureEnvelope` with a specific, correct `reason`.

---

## 1. Error code table (source of truth — mirrors `shared/src/errors.ts`)

| Code               | When                                                                         | Charge                                                              |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `UNAUTHORIZED`     | Token/key invalid, expired, or account has no matching plan row              | none                                                                |
| `INVALID_URL`      | Zod schema rejects the input (not a URL, bad viewport, etc.)                 | none                                                                |
| `SSRF_BLOCKED`     | Pre-check or authoritative SSRF check rejects the resolved target            | none                                                                |
| `QUOTA_EXCEEDED`   | Redis quota check fails before enqueue                                       | none                                                                |
| `RATE_LIMITED`     | Per-account/per-key short-window rate limit exceeded before enqueue          | none                                                                |
| `BLOCKED`          | Ladder exhausted, classifier verdict was `CHALLENGE`/`HARD_BLOCK` throughout | half (0.5)                                                          |
| `TIMEOUT`          | `JOB_DEADLINE_MS` or `SERVER_AWAIT_MS` exceeded                              | half (0.5) if a rung was attempted, none if it never left the queue |
| `UPSTREAM_4XX`     | Target origin returned 4xx that isn't a block signal                         | half (0.5)                                                          |
| `UPSTREAM_5XX`     | Target origin returned 5xx                                                   | half (0.5)                                                          |
| `RENDER_ERROR`     | Non-HTML response, extractor crash, unrecoverable page error                 | half (0.5) if a rung was attempted                                  |
| `BUDGET_EXHAUSTED` | Ran out of deadline budget mid-ladder before exhausting rungs                | half (0.5)                                                          |

Full charge policy rationale lives in `11-billing-and-quota.md`. This table exists so charge decisions are looked up, not re-derived per call site.

---

## 2. What never goes in a user-facing `message`

- Stack traces, raw exception `.toString()` output.
- SQL error text, Redis error text, or any driver-level error message.
- Internal file paths, package/module names, environment variable names.
- Raw upstream response bodies from the target site (they're untrusted third-party content — never echo them back into Ocular's own response).
- Proxy provider names/credentials/account identifiers.

`message` is a short, human-readable sentence explaining what happened from the agent's point of view (e.g., "The target site blocked automated access after exhausting all stealth options."). Internal detail goes to structured logs (§3), correlated by `requestId`.

---

## 3. Structured logging

Every job emits one structured log line (JSON) per stage transition, keyed by `requestId` so `mcp-server` and `worker` logs correlate across the two deployables:

```typescript
// minimum required fields per job-level log line
{
  requestId: string;
  tool: 'view_page' | 'inspect_ui' | 'extract_assets' | 'get_quota';
  domain: string;
  rungReached: number;
  verdict: 'CLEAN' | 'CHALLENGE' | 'HARD_BLOCK' | 'EMPTY' | null;
  proxyBytesUsed?: number;
  wallTimeMs: Record<string, number>;   // per-stage timing
  payloadKb?: number;
  outcome: ErrorCode | 'SUCCESS';
  chargeApplied: 0 | 0.5 | 1;
  authMethod: 'oauth' | 'static_key';
}
```

**Never log:** the target URL's full query string if it may contain tokens/PII passed by the calling agent (log the origin + path, redact query params by default), account tokens/API keys, proxy credentials, or raw page content/screenshots.

---

## 4. Retry policy

- BullMQ jobs are `attempts: 1` — the stealth ladder is the retry mechanism, not BullMQ's own retry. A second BullMQ-level retry would double-charge the deadline and double the cost of a Rung-3 attempt.
- Client-side retries (the calling agent retrying a `TIMEOUT`) are the agent's decision — Ocular does not implicitly retry a failed job server-side beyond what the ladder already does internally.

---

## 5. Uncaught errors

Any error that escapes the tool-handler/worker-pipeline try/catch (a genuine bug, not an expected failure mode) still resolves to a `FailureEnvelope` with `RENDER_ERROR` (worker-side) or a generic MCP protocol error (mcp-server-side) — the agent never receives a raw 500 or an unhandled-exception stack. The full exception is logged with `requestId` for debugging, sanitized per §2/§3.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
