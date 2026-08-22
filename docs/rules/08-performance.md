# Ocular — Performance Rules

**Section 8 of 12 · Always Apply**

---

## 0. Starting configuration constants (tune, don't trust — defined once in `shared/src/constants.ts`)

| Const                      | Start value | Notes                                                    |
| -------------------------- | ----------- | -------------------------------------------------------- |
| `RENDER_CONCURRENCY`       | 4           | simultaneous pages/browser on a 4vCPU/8GB worker         |
| `QUEUE_CONCURRENCY`        | 8           | BullMQ jobs pulled; gated by the render semaphore        |
| `JOB_DEADLINE_MS`          | 10000       | hard per-request budget, absolute timestamp not duration |
| `SERVER_AWAIT_MS`          | 12000       | > job deadline, mcp-server's own await ceiling           |
| `BROWSER_RECYCLE_REQUESTS` | 300         | recycle on whichever threshold hits first                |
| `BROWSER_RECYCLE_MINUTES`  | 30          | "                                                        |
| `IMG_MAX_EDGE_PX`          | 1568        | strictest common vision-model cap                        |
| `IMG_WEBP_QUALITY`         | 75          | starting quality, steps down to hit KB target            |
| `IMG_MAX_KB`               | 200         | brief's ceiling                                          |
| `MAX_ESCALATIONS`          | 2           | rungs beyond the routing-memory start point              |
| `DAILY_PAID_BUDGET_USD`    | set low     | circuit breaker on Rung-3 spend                          |
| `JWKS_CACHE_TTL_S`         | 600         | AuthKit key rotation tolerance                           |
| `RATE_LIMIT_WINDOW_S`      | 60          | sliding window size, per account/key                     |
| `RATE_LIMIT_MAX_REQUESTS`  | 20          | max tool calls per window, independent of monthly quota  |

Never hardcode these values inline at a call site — import from `shared/src/constants.ts`. A PR that changes one of these numbers updates this table in the same diff.

---

## 1. Why `RENDER_CONCURRENCY` is 4, not 15

The original brief specified 15 concurrent jobs/worker. Research established this would OOM an 8GB node running Chromium — see `research & planning/02` §2 for the memory math. `RENDER_CONCURRENCY` is the render semaphore's capacity; `QUEUE_CONCURRENCY` (BullMQ's own pull concurrency) can be higher because it's gated _by_ the semaphore, not a separate bottleneck. Do not raise `RENDER_CONCURRENCY` without re-validating against real RSS measurements on the target node size.

---

## 2. Latency budget

Target: **P50 under ~4–6s, P95 under the 10s ceiling** on the happy path (single rung, no escalation). Every stage in `05-worker-and-browser-pipeline.md` §1 must account for its slice of this budget:

```
Queue wait (mcp-server enqueue -> worker pickup)   — minimize via QUEUE_CONCURRENCY headroom
SSRF resolve + navigate (domcontentloaded)         — dominant cost, ~2-4s typical
smart-scroll/settle                                 — bounded sub-timer, not open-ended
extractor (page.evaluate)                           — capped, should be <500ms typical
image pipeline (sharp)                              — should be <300ms typical for a single screenshot
```

If a stage is consistently eating a disproportionate share of the 10s budget in telemetry, that's the next optimization target — not a reason to raise `JOB_DEADLINE_MS`.

---

## 3. Cost budget

Target: **≤ ~$0.002/run server cost on the happy path.** Cost drivers, in order of magnitude:

1. Rung-3 paid unblocker (~$0.0015/call ≈ 75% of the _entire_ run budget when it fires) — this is why it's gated by both a per-request ceiling and `DAILY_PAID_BUDGET_USD`.
2. Residential proxy bandwidth (Rung 1+) — routing memory exists specifically to avoid paying this cost repeatedly for domains that reliably clear at Rung 0.
3. Compute (worker CPU/RAM time) — amortized by the warm-pool/recycle model, not a per-request line item to optimize further at this stage.

**Rule:** any change that increases the average rung reached for a broad set of domains (e.g., loosening the `BlockClassifier`'s `CLEAN` threshold) is a cost regression — validate against the success-rate-by-rung metric (see `11-billing-and-quota.md` §4) before merging.

---

## 4. Memory management

- One Chromium instance per worker process — never launch a second browser instance to handle overflow; queue depth (`QUEUE_CONCURRENCY`) and the semaphore handle backpressure instead.
- Scheduled recycle at `BROWSER_RECYCLE_REQUESTS` or `BROWSER_RECYCLE_MINUTES`, whichever comes first — this is the primary defense against Chromium RSS growth over a long-running process, not a "nice to have."
- `/dev/shm` sized generously in the Docker image; `tini` as PID1 for zombie process reaping (Chromium spawns subprocesses that need proper reaping or they silently accumulate).
- Every context/page is closed in `finally`, unconditionally — see `05-worker-and-browser-pipeline.md` §1. This is the single highest-leverage memory rule in the codebase.

---

## 5. Image/token economics

The image pipeline exists because vision-model token cost scales with image size, and the _agent's_ budget (not Ocular's) is what a bloated image burns. `IMG_MAX_EDGE_PX` / `IMG_WEBP_QUALITY` / `IMG_MAX_KB` are tuned to the strictest common vision-model input cap, not to Ocular's own bandwidth cost. The `detail` knob exists so the agent can trade fidelity for token cost explicitly — never silently upgrade or downgrade `detail` server-side based on Ocular's own cost concerns.

---

## 6. What NOT to optimize prematurely

- Do not add a second `BrowserProvider` implementation, a caching layer for rendered pages, or horizontal proxy-pool logic beyond what's in `06-external-fetching-and-egress.md` before M8 (Observability + load test) produces real numbers showing they're needed. See `research & planning/03` §10 for milestone order — premature infra ahead of measured bottlenecks is scope creep.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
