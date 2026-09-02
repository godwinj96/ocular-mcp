# Ocular — Billing & Quota Rules

**Section 11 of 13 · Always Apply**

---

## 0. Charge policy (locked — see `research & planning/02` §13)

> **Amended 2026-09-01** (`docs/Ocular_PRD_v0.2.md` §4). Charges apply to **cloud renders only**. Local renders are unmetered — see §0a. The quota period changed from monthly to **daily** for cloud, and escalated rungs now cost **multiple units** — see §0b.

- A render that reaches `CLEAN` at any rung → **full charge (1.0 × rung multiplier)** against the daily cloud quota.
- A render that exhausts the stealth ladder (including an attempted Rung-3 paid fallback) and still fails → **half charge (0.5)**. It consumed proxy/compute; the user gets a discount, not a refund.
- A request rejected before enqueue (`UNAUTHORIZED`, `INVALID_URL`, `SSRF_BLOCKED`, `QUOTA_EXCEEDED`) → **no charge**. It never reached the worker.
- Full error-code-to-charge mapping: `09-error-handling-and-logging.md` §1.

**Rule:** the half-charge leniency is deliberately generous UX, not a loophole — it's backstopped by per-key rate limiting (`07-security.md` §4), independent of quota. Never weaken rate limiting to "fix" perceived abuse of the half-charge policy; that's the wrong lever.

---

## 0a. Local renders are unmetered

`packages/local-worker` executes on the user's own machine. Marginal cost to Ocular is zero, so local renders consume **no quota** — this is what makes the dev-loop wedge viable, where high call frequency is the norm.

**Rule:** unmetered does not mean unauthenticated. `local-worker` must validate an active subscription against the server, or local rendering is trivially freeloadable. Validate against a **cached, periodically-refreshed** subscription state — never a live network round-trip per capture, which would reintroduce exactly the latency the local path exists to eliminate.

**Rule:** define and document the offline grace window explicitly (how long a cached subscription check stays valid without network). A developer on a plane must not lose their dev loop; a lapsed subscriber must not get indefinite free rendering. Pick a number, put it in `shared/src/constants.ts`, don't leave it implicit.

---

## 0b. Cloud quota: daily cap with per-rung multipliers

The original flat 300/month quota predates the local/cloud split and is superseded.

|       | Quota                               |
| ----- | ----------------------------------- |
| Local | Unlimited (§0a)                     |
| Cloud | **~30-50/day** (~1,000-1,500/month) |

**Escalated rungs cost multiple units rather than being feature-gated.** Rung 1 is residential proxy, billed per GB — roughly $0.002–0.005 per render depending on page weight. At ~10% escalation that is comfortably absorbed; at 60–80% escalation (a user whose targets are mostly protected sites) it breaks the tier's unit economics entirely.

Charging a rung-1 render ~3 units against the daily cap means a user who escalates constantly exhausts their cap ~3× faster. Cost is bounded automatically, with no separate escalation quota and no hard feature wall.

| Tier                             | Rungs available        |
| -------------------------------- | ---------------------- |
| Base ($2.50/mo)                  | Rungs **0 and 1**      |
| Higher (~$13.99/mo, provisional) | Adds rungs **2 and 3** |

**Rule:** rung multipliers live in `shared/src/constants.ts` and are applied inside `chargeForEnvelope` (`@ocular/shared`), which stays the single source of truth for charge derivation. Do not compute a multiplier at any call site.

**Blocking dependency:** exact multipliers and the higher-tier price cannot be finalized without real per-rung cost data, which requires the M3 vendor accounts (Webshare, DataImpulse, Camoufox, Decodo). Both are provisional until then — do not treat the numbers above as settled.

---

## 1. Quota is a float, not an integer

Redis stores quota as a float counter _because_ of the 0.5 charge value. Never round mid-calculation — round only for display in `get_quota` responses. A `parseInt` or integer cast anywhere in the quota decrement path is a bug. Rung multipliers (§0b) multiply into the same float; they do not make the value integral.

**Rule:** `get_quota` reports the **cloud** quota. Since local renders are unmetered, the response must make clear which path the number applies to — an agent seeing a low remaining count should not conclude its local dev-loop captures are about to stop working.

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

**Implemented** (Session 14) via the `bachs-sdk` npm package (unofficial, MIT, zero-dependency — verified directly against its published source before adoption): `packages/dashboard/app/webhooks/bachs/route.ts` receives and HMAC-verifies (`bachs.webhooks.constructEvent`) `checkout.completed`, `customer.subscription.created/updated/deleted`, and `invoice.paid/payment_failed`; `packages/dashboard/lib/apply-bachs-event.ts` is the pure event→account-update mapping (unit-tested in isolation); `packages/dashboard/lib/accounts.ts`'s three settlement functions apply it to Postgres. **Correction to this section's earlier assumption:** Session 2's research concluded Bachs had no hosted customer-billing-portal UI, so cancellation was scoped as dashboard-owned. That's since changed on Bachs's end — `bachs.customerSessions.create` (`POST /customers/{id}/portal-sessions`) is a real hosted portal, confirmed via the SDK's own type definitions, not re-assumed from the earlier note. `BachsClient.createPortalSession` now uses it directly; no custom in-house cancel-subscription UI was built.

---

## 4. Static API key issuance (headless/CI path)

Static keys are minted from a dashboard, backed by a Bachs-linked account, stored in Postgres, checked directly against the account table (no AuthKit round-trip — see `04-mcp-server-and-auth.md` §2). Keys are revocable and rotatable with no default expiry. The issuance flow itself is a Phase-1 M5 deliverable — track its UX/API in `research & planning/05-user-flows.md`.

---

## 5. Observability the billing model requires

Per §9 of `research & planning/03`, every job's structured log (see `09-error-handling-and-logging.md` §3) includes `chargeApplied`. Aggregate dashboards must be able to answer, at minimum:

- Success rate by rung and by domain (drives routing-memory tuning, surfaces newly-hard sites).
- Rung-3 call rate and spend against `DAILY_PAID_BUDGET_USD` — enforced as a real global circuit breaker since Session 26 (`packages/worker/src/ladder/paid-budget.ts`'s `tryReservePaidBudget`, an atomic Redis EVAL gating `stealth-ladder.ts`'s `tryPaidUnblockerRung` before every Decodo call, reset at UTC midnight like the quota keys). This closes the audit's "half-charge economic DoS" finding — repeated rung-3 attempts now hit a hard daily $ ceiling regardless of how many distinct accounts are driving them.
- Half-charge rate over time (a rising trend may indicate a classifier regression, not just harder sites).
- **Escalation rate per user** — the input that validates or breaks the §0b multiplier model. If the real distribution of rung-1 escalations differs materially from the ~10% assumption, the multipliers need retuning before the tier loses money.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
