# Ocular — Billing & Quota Rules

**Section 11 of 12 · Always Apply**

---

## 0. Charge policy (locked — see `research & planning/02` §13)

- A render that reaches `CLEAN` at any rung → **full charge (1.0)** against monthly quota.
- A render that exhausts the stealth ladder (including an attempted Rung-3 paid fallback) and still fails → **half charge (0.5)**. It consumed proxy/compute; the user gets a discount, not a refund.
- A request rejected before enqueue (`UNAUTHORIZED`, `INVALID_URL`, `SSRF_BLOCKED`, `QUOTA_EXCEEDED`) → **no charge**. It never reached the worker.
- Full error-code-to-charge mapping: `09-error-handling-and-logging.md` §1.

**Rule:** the half-charge leniency is deliberately generous UX, not a loophole — it's backstopped by per-key rate limiting (`07-security.md` §4), independent of monthly quota. Never weaken rate limiting to "fix" perceived abuse of the half-charge policy; that's the wrong lever.

---

## 1. Quota is a float, not an integer

Redis stores quota as a float counter _because_ of the 0.5 charge value. Never round mid-calculation — round only for display in `get_quota` responses. A `parseInt` or integer cast anywhere in the quota decrement path is a bug.

---

## 2. Atomic quota operations

The quota check-and-decrement in `mcp-server` (§3 step 6 of `04-mcp-server-and-auth.md`) is a single atomic Redis operation (e.g., a Lua script or `MULTI`/`EXEC` with optimistic locking), never a read-then-write pair. Two concurrent requests near the cap must not both pass the check based on a stale read — see the mandatory race-condition test in `10-testing.md` §3.

The actual charge (1.0, 0.5, or 0) is applied by `worker` after the job resolves, via a second atomic operation keyed by the same `requestId` — reconcile against the pre-enqueue reservation rather than double-decrementing. Implemented in `worker/src/quota/settle-quota.ts`: `chargeForEnvelope` (in `@ocular/shared`, mirrors the `09-error-handling-and-logging.md` §1 table exactly) derives the actual charge from the resolved envelope, and a Lua script refunds `SUCCESS_CHARGE - actualCharge` back into the quota key, guarded by a `quota-settled:{requestId}` idempotency key so a duplicate settlement call never refunds twice. If the quota key has already expired by settlement time (billing cycle rolled over mid-job), the refund is skipped rather than resurrecting a stale key into a new cycle.

---

## 3. Bachs ↔ Postgres ↔ Redis sync

```
Bachs (subscription/payment source of truth)
   │ webhooks (subscription created/updated/canceled/payment failed)
   ▼
Postgres (account ↔ plan ↔ OAuth-subject mapping) — the durable record
   │ read on token verification (§3 of 04-mcp-server-and-auth.md)
   ▼
Redis (hot-path quota counter, reset on billing cycle boundary per plan)
```

**Rule:** `mcp-server` never calls the Bachs API synchronously in the request path — all Bachs interaction is webhook-driven and async, off the hot path (per `01-architecture.md` §0 diagram). A slow or down Bachs never blocks a tool call.

**Rule:** an AuthKit-authenticated user with no matching Postgres account row (webhook lag, or a user who signed in but never completed checkout) is `UNAUTHORIZED` — never default to a free/guest quota tier. See `04-mcp-server-and-auth.md` §3 step 3.

**Rule:** Redis quota state degrading (cache miss, Redis down) fails closed: `QUOTA_EXCEEDED`, not an open gate. Routing memory degrading, by contrast, fails soft (starts at Rung 0) — these are different failure modes with intentionally different defaults; do not conflate them.

---

## 4. Static API key issuance (headless/CI path)

Static keys are minted from a dashboard, backed by a Bachs-linked account, stored in Postgres, checked directly against the account table (no AuthKit round-trip — see `04-mcp-server-and-auth.md` §2). Keys are revocable and rotatable with no default expiry. The issuance flow itself is a Phase-1 M5 deliverable — track its UX/API in `research & planning/05-user-flows.md`.

---

## 5. Observability the billing model requires

Per §9 of `research & planning/03`, every job's structured log (see `09-error-handling-and-logging.md` §3) includes `chargeApplied`. Aggregate dashboards must be able to answer, at minimum:

- Success rate by rung and by domain (drives routing-memory tuning, surfaces newly-hard sites).
- Rung-3 call rate and spend against `DAILY_PAID_BUDGET_USD`.
- Half-charge rate over time (a rising trend may indicate a classifier regression, not just harder sites).

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
