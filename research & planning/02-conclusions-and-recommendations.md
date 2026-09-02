# 02 — Conclusions & Recommendations (Ocular Phase 1)

This document turns the research in `01` into decisions. Each section states a conclusion, the reasoning, and — where relevant — **where it deviates from the original brief**. The build plan in `03` assumes every decision here.

Legend: ✅ keep brief's decision · ✏️ refine brief's decision · ⚠️ deviate from brief.

---

## 1. ⚠️ Browser engine: default to **Patchright**, keep Playwright's model

**Conclusion.** Keep the Playwright _programming model_ (contexts, auto-wait, API) but run it through **Patchright** (`patchright` npm, `channel: 'chrome'` against a real installed Chrome), not vanilla `playwright`. Patchright is API-compatible, so no application code changes; it patches the CDP/`Runtime.enable` leaks that put vanilla Playwright and `rebrowser-playwright` at the bottom of 2026 Cloudflare benchmarks.

**Why deviate.** The brief's "Playwright over Puppeteer" reasoning (isolated contexts, auto-waiting, cross-browser) is sound and unchanged — but "vanilla Playwright" is now a _detectable_ transport. The single highest-leverage change to hit the brief's reliability goal is swapping the driver, at near-zero code cost.

**Why not nodriver** (the only zero-block tool): it is Python + AGPL-3.0. Adopting it means abandoning the committed Node/TypeScript worker and taking a copyleft license into a commercial product. Not worth it when Patchright + the paid fallback closes the same gap.

**Secondary engine (optional, later in Phase 1):** keep a `Camoufox` (Firefox) provider behind the same interface for the minority of targets that fingerprint Chromium forks specifically. Introduce only if telemetry shows a cluster of Chromium-specific blocks.

---

## 2. ✏️ Stealth is a _stack_, not a plugin — and it's layered by cost

**Conclusion.** Implement stealth as an ordered escalation ladder, cheapest first, stopping at the first rung that returns a clean render:

1. **Rung 0 — Patchright + datacenter proxy + humanized behavior** (default; ~95%+ of traffic should resolve here). Humanization = randomized viewport/UA within realistic device profiles, mouse-jitter, variable scroll cadence, timezone/locale aligned to proxy geo.
2. **Rung 1 — Patchright + residential proxy** (escalate on 403 / challenge HTML / Turnstile detected).
3. **Rung 2 — Camoufox + residential** (optional; only if Chromium-specific block signature seen).
4. **Rung 3 — Commercial unblocker API** (the paid fallback; rare, hard-capped per user).

**Detection of "did we get blocked"** is its own sub-problem: check HTTP status (403/429/503), known challenge markers (Cloudflare `cf-mitigated`, Turnstile widget, `__cf_chl`), title/body heuristics ("Just a moment…", "Attention Required"), and near-empty render heuristics. This "block classifier" gates escalation.

**Why refine.** The brief's two-tier (DC→residential on 403) is correct but under-specified. Research shows escalation must be _evidence-driven and bounded_: blind retries burn proxy bandwidth (the 15–20% buffer tax) and clock (the 10s budget). Cap total escalations per request (e.g., ≤2 rungs) so a doomed URL fails fast instead of grinding to timeout.

---

## 3. ⚠️ Add a per-domain **routing memory** (this is the real telemetry moat)

**Conclusion.** Maintain a small Redis-backed table keyed by registrable domain recording the _cheapest rung that recently succeeded_ and the winning fingerprint profile, with TTL/decay. On the next request to that domain, **start at the known-good rung** instead of always starting at Rung 0 and paying failed attempts.

This operationalizes the brief's stated moat ("Behavioral Stealth Fingerprinting Matrixes" + "Deterministic Interface Structural Maps") into something concrete and cheap: a feedback loop where the fleet gets faster and cheaper per domain over time. It cuts both latency (fewer failed rungs) and cost (less wasted residential bandwidth).

**Why deviate/refine.** The brief describes the moat abstractly; this makes it a shippable component with direct P50-latency and cost payoff. It is the difference between "re-fight every site every time" and "learn each site once."

---

## 4. ⚠️ Concurrency: **15 jobs/worker is too high — use ~3–4 active renders/browser**

**Conclusion.** The brief's "hard limit of 15 concurrent jobs per worker thread" will OOM-crash an 8GB node. Every production source converges on **3–4 concurrently _rendering_ pages per browser on 8GB**. Reconcile the two numbers with a **two-level queue**:

- **BullMQ worker concurrency** (jobs pulled from Redis): can be moderate (e.g., 8–12) _iff_ gated by…
- **A hard in-process semaphore of 3–4 simultaneous `page` renders.** Jobs beyond the semaphore wait in-memory, not in Chromium.

So "15" becomes a queue-depth number, not a simultaneous-Chromium-tabs number. Tune the render semaphore empirically against RSS on the target VPS; treat 4 as the starting ceiling for a 4vCPU/8GB Hetzner node.

**Why deviate.** Directly contradicts a brief figure, but the brief's own risk section already flags Chromium memory degeneration — the concurrency cap is the primary defense.

---

## 5. ✅ + ✏️ Warm-pool architecture, with disciplined lifecycle

**Conclusion.** Keep the brief's warm-pool model (one master Chromium per worker host, ephemeral `BrowserContext` per request). Add the non-negotiable lifecycle discipline from research:

- Launch browser once per worker; **fresh context per request, always closed in `finally`.**
- **Recycle the browser** after N requests (start N≈300, tune) **or** M minutes, whichever first — drain in-flight, relaunch, zero-downtime via a standby browser handle.
- **Reap zombies** (`tini`/`dumb-init` as PID 1) and size `/dev/shm` properly in the container.
- Hard **10s wall-clock timeout** per job with guaranteed context teardown even on timeout/throw (else contexts leak and the worker dies slowly).

**Escape hatch (founder decision #2):** put every browser interaction behind a `BrowserProvider` interface (`SelfHostedProvider` today; `ManagedBrowserProvider` swappable later). The worker pipeline never imports Patchright directly.

---

## 6. ✅ + ✏️ Image pipeline: render big, ship small, make token-cost a knob

**Conclusion.** Validate the brief's WebP + 100–200KB budget and make token economics an explicit, agent-controllable feature:

- Render at a fixed desktop viewport (e.g., 1280×800, DPR configurable).
- After capture, **downscale the long edge to a ceiling (default 1568px** — the strictest common vision cap, Claude's) using `sharp`, then encode WebP at tuned quality (start q≈75) targeting ≤200KB.
- Expose a `detail` parameter: `low` (aggressive downscale, small tokens), `high` (near cap). Default to a balanced middle.
- For very tall pages, prefer a **viewport/segmented capture** or capped full-page height over an unbounded full-page PNG that blows both the KB budget and the token bill.
- Never ship PNG on the wire to the client. `sharp` does the WebP encode + resize in one pass in-worker; the buffer is base64'd into the MCP `image` content block and **wiped from memory** immediately (matches brief's no-persistence rule).

---

## 7. ✅ Three atomic tools, thin MCP client, all heavy work server-side

**Conclusion.** Keep the brief's three-tool decomposition — `view_page`, `inspect_ui`, `extract_assets` — as separate MCP tools so agents pull only what they need (token discipline). A fourth (`get_quota`) and a fifth (motion capture) tool were added later; see `docs/Ocular_PRD_v0.2.md`.

**⚠️ Amended 2026-09-01 (PRD v0.2, `docs/rules/13-local-worker-and-distribution.md`):** the sentence originally here — "the local MCP server is a thin stdio↔HTTPS shim... no browser logic ever runs locally" — is **superseded**. The local path is no longer a proxy to the cloud gateway. It is a full local render pipeline: a Go supervisor spawns and manages `chrome-headless-shell` over CDP directly on the user's machine, exposed through a local stdio MCP server, for localhost/dev-server/authenticated-page targets. The cloud gateway (this section's original design) is retained for public, unauthenticated targets — the two are now parallel execution paths, not a client-shim-to-single-backend model. See `docs/rules/13-local-worker-and-distribution.md` for the full architecture.

Add a 4th read-only tool, `get_quota`, so agents/users can see remaining monthly calls without triggering a render.

---

## 8. ✏️ Reliability-first, but with three hard guardrails (founder decision #3)

**Conclusion.** Default to returning a usable result, bounded by:

1. **Per-user monthly quota** (brief: ~300 calls/mo). Enforced atomically in Redis before enqueue.
2. **Per-request cost ceiling** — a request may spend at most one Rung-3 (paid) call; if that fails, return a graceful structured failure, not an infinite escalation.
3. **Global daily paid-fallback budget** — a fleet-wide circuit breaker on Rung-3 spend so a bad traffic day (or an abuse spike) can't run up an unbounded unblocker bill. When tripped, Rung-3 disables and hard sites fail gracefully until reset.

Failures are always **structured** (`{ ok: false, reason, rung_reached, partial? }`) so the agent can react intelligently instead of getting an opaque error.

**⚠️ Amended 2026-09-01 (PRD v0.2 §4, `docs/rules/11-billing-and-quota.md` §0b):** guardrail 1's flat monthly quota is superseded and now applies to the **cloud path only** — local-worker renders are unmetered (zero marginal cost) but require an active, periodically-validated subscription. The cloud quota itself changed from a flat monthly count to a **daily cap** (~30-50/day, ~1,000-1,500/month) with per-rung charge multipliers (an escalated render costs more than one daily-cap unit) — exact cap and multipliers are provisional pending real M3 vendor cost data; see `docs/rules/11-billing-and-quota.md` §0b and `packages/shared/src/constants.ts`. Guardrails 2 and 3 are unaffected — both remain cloud-path, stealth-ladder concerns.

---

## 9. ✅ + ✏️ Backend stack: Node/TS everywhere, BullMQ+Redis, but mind the topology

**Conclusion.** Keep Node/TypeScript + BullMQ + Redis. Refinements:

- **Runtime: Node LTS, not Bun,** for the workers — Playwright/Patchright and `sharp` are native-addon heavy and best-supported on Node; Bun is acceptable for the light API gateway but not worth the risk on the browser worker. Standardize on Node to avoid a split toolchain.
- **API gateway** stays thin: authenticate, quota-check, enqueue to BullMQ, await job result (with its own timeout), return. Stateless and horizontally scalable.
- **Redis** does triple duty: BullMQ backing store, quota counters, and the per-domain routing memory (§3). One managed Redis in Phase 1; watch it as a single point of failure.
- **Result delivery:** job → result should be request/response-shaped to the gateway. Use BullMQ's job-completion await (or a short-lived result key) rather than holding a browser render on the synchronous HTTP path.

---

## 10. ⚠️ Defer the cookie/authenticated-browsing feature out of Phase 1 MVP

**Conclusion.** The brief's open question — streaming a user's local session cookies into an ephemeral **cloud** worker to inspect authenticated dashboards — is the single highest-risk feature (cross-tenant session bleed, credential handling, expanded SSRF blast radius). **Ship Phase 1 without it, on the cloud path.** Land the public-web MVP, then design cookie-handling as a deliberate, threat-modeled follow-up with memory-only handling and per-request context isolation. Note it prominently in docs as "coming later" rather than half-building it.

**⚠️ Amended 2026-09-01 (PRD v0.2 §5, `docs/rules/13-local-worker-and-distribution.md` §5, `docs/rules/07-security.md` §8):** this deferral is superseded, not for the cloud path but with a local-path carve-out. Cookie extraction/session replay from the user's browser remains permanently rejected on both paths — Chrome's Device Bound Session Credentials kills that approach structurally, not just as a risk-avoidance choice. But authenticated browsing itself is no longer categorically deferred: the local worker resolves it without ever moving a session — the user logs in once inside Ocular's own persistent local Chromium profile, on their own machine, and the credential never leaves the device. This is local-worker phase 2 (not day one), scoped after the unauthenticated local path is stable. The cloud-side deferral in this section stands unchanged.

---

## 11. ✏️ Security is a Phase-1 requirement, not a later hardening pass

**Conclusion.** Because MCP tool inputs are attacker-controllable via the LLM, the following are **MVP-blocking**, not nice-to-haves:

- **SSRF guard at the gateway** _and_ re-validated at the worker: reject non-http(s) schemes; resolve DNS and block RFC-1918, loopback, link-local, and cloud metadata IPs (`169.254.169.254`); block redirects that land on internal IPs (re-check after each hop).
- **Egress isolation** of worker nodes: they should not have network routes to internal infra (Redis, gateway admin) beyond what they strictly need; treat every worker as internet-facing and hostile-input-facing.
- **Absolute-link rewriting** (`extract_assets`) must only emit public absolute URLs, never internal ones.
- **API-key auth** on the gateway from day one (keys map to quota + plan). No unauthenticated render path.
- **Per-key rate limiting** independent of monthly quota, to blunt abuse bursts.

---

## 12. ⚠️ Transport & auth: remote Streamable-HTTP MCP server with OAuth 2.1, not local stdio + API key

**Conclusion.** Ship Ocular as a **remote MCP server** (Streamable HTTP transport) authenticated via **OAuth 2.1 + PKCE + dynamic client registration**, using **WorkOS AuthKit** as the hosted authorization server (free tier covers full MCP OAuth support: DCR, PKCE, Resource Indicators, Protected Resource Metadata, CIMD). Configure Google as an upstream social login inside AuthKit so the end-user experience is "click Sign in with Google," while AuthKit remains the actual token issuer, correctly scoped to Ocular's MCP resource. Keep a **static API key** (`Authorization: Bearer`) as a fallback for headless/CI/unattended-agent use where no browser exists for the OAuth redirect.

**Why deviate.** As of the November-2025 MCP spec revision, any internet-reachable MCP server is expected to implement OAuth 2.1+PKCE to work with off-the-shelf clients — this isn't just nicer UX, it's closer to spec-compliant. It also reaches **web-based agent surfaces** (ChatGPT, Claude.ai) that only support remote MCP, not stdio — a real win against the brief's "Autonomous Web Task Agents" persona. It removes the token-in-a-config-file leak risk that pushed Supabase's own MCP server away from copy-pasted personal access tokens. Local stdio packaging (the brief's original "npx install" plan) is **deferred**, not abandoned — it becomes a thin client-side bridge that can be added later without touching the backend.

**⚠️ Amended 2026-09-01:** local stdio is no longer deferred, and it did not turn out to be a thin bridge. It shipped as a full local render pipeline (Go supervisor + `chrome-headless-shell` via CDP) per PRD v0.2 and `docs/rules/13-local-worker-and-distribution.md` — a first-class execution path alongside this section's remote+OAuth design, not a later fast-follow client shim.

**Known risk:** client support for remote+OAuth MCP servers is not uniformly solid yet (documented flakiness in at least one popular IDE client as of this research). The static-key fallback exists specifically to de-risk this.

## 13. ✅ Charge policy: full charge on success, half charge on exhausted failure

**Conclusion.** A render that completes cleanly costs 1 full quota unit. A render that exhausts the entire stealth ladder (through the paid fallback, if attempted) and still fails costs 0.5 units — it consumed real proxy/compute, so it isn't free, but the user isn't fully billed for a tool that didn't work. Abuse of this leniency is caught by **per-key rate limiting**, which is independent of monthly quota. Quota must be a float counter, not an integer, in Redis.

## 14. ⚠️ Billing: Bachs over Stripe

**Conclusion.** Use **Bachs** (bachs.io) as the payments/subscription platform rather than raw Stripe. Bachs handles checkout, subscriptions, usage billing, tax, and settlement in one integration, with broader payment-method reach (cards, mobile money, stablecoins) across Africa, Europe, and North America — a better fit than Stripe alone for a $1/mo global indie-developer audience where reach and low-friction local payment methods matter more than Stripe's deeper US/EU tooling ecosystem. Keep a small Postgres table (account ↔ plan ↔ OAuth-subject mapping) synced via Bachs webhooks, same pattern as any merchant-of-record integration.

## 15. 🟡 Hosting: worker/mcp-server — reopened, not yet decided

**Status as of 2026-09-02 (Session 26).** This section previously recorded Hetzner, EU as the confirmed worker-fleet host — that decision was never actually provisioned (no Dockerfile, no compose file, no infra config exist anywhere in the repo for it) and is corrected here rather than left stale. `dashboard`/`website` are confirmed and live on Vercel; `worker`/`mcp-server`'s actual host is an open founder decision. Whatever is chosen must support: a long-lived process holding a warm, recyclable Chromium instance (the current architecture, not a per-invocation model — see `packages/worker/src/providers/self-hosted-provider.ts`), and network-level egress filtering in front of every Chromium process (the SSRF mitigation `docs/rules/07-security.md` §3 depends on — application-layer URL checks alone are insufficient, per the 2026 adversarial security audit). Revisit once a host is chosen.

---

## 16. ⚠️ Vendor stack — optimized for generous free tiers + easy scaling

**Conclusion.** For every remaining piece of paid/managed infra, pick the vendor that lets Ocular start at effectively $0 and scale usage-based, rather than the cheapest-at-volume or most-feature-complete option:

| Role                                                                       | Vendor                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis** (queue + quota + routing memory)                                 | **Upstash**             | 256MB / 500K commands/mo free, no card required, pay-as-you-go beyond that ($0.20/100K commands), no bandwidth charge up to 200GB/mo. Fully Redis-protocol compatible — BullMQ works against it unmodified. Scales from "$1/mo product with a handful of users" to real volume without a migration.                                                                                                                                                                                                                                               |
| **Postgres** (accounts/plan/OAuth-subject)                                 | **Neon**                | 100 CU-hours + 0.5GB free, 10 branches/project, **scale-to-zero** compute. Since WorkOS AuthKit already owns auth, Ocular doesn't need Supabase's bundled auth/storage — Neon's pure usage-based pricing (no monthly floor) fits a product whose per-account DB load is sparse and bursty far better than Supabase's flat $25/mo Pro floor.                                                                                                                                                                                                       |
| **Datacenter proxy** (StealthLadder Rung 0)                                | **Webshare**            | Most generous free tier in the category: 10 free proxies + 1GB bandwidth/mo, no card required. Catalog opens at $0.0299/IP, dropping further at volume — cheap enough to run as the default rung for the ~95% of traffic that should resolve here.                                                                                                                                                                                                                                                                                                |
| **Residential proxy** (Rung 1)                                             | **DataImpulse**         | Value floor at $1/GB PAYG (vs. $3–8/GB industry average), traffic **never expires**, 99.51% published success rate. $5/5GB intro has no time limit and no business verification, so you can validate the ladder before committing spend.                                                                                                                                                                                                                                                                                                          |
| **Commercial unblocker** (Rung 3, revises `01`'s earlier Bright Data lean) | **Decodo Web Unlocker** | Real free tier (2K requests, no card charge) and transparent tiered pricing ($0.50→$0.14 per 1K as commitment grows) that a solo/bootstrapped account can actually access. **Bright Data's Web Unlocker trial requires business/KYC verification**, which blocks an indie founder from even testing it pre-revenue — disqualifying against the "easy to scale into" requirement despite its flatter unit economics at scale. Revisit Bright Data once Ocular is an incorporated, KYC-able business with real Rung-3 volume to justify the switch. |

**Net effect:** the entire Phase 1 infra stack (Redis, Postgres, DC proxy) can be provisioned and validated at **$0 cash outlay**, with the residential proxy and unblocker tiers needing only small, low-commitment top-ups ($5–$20) to test the stealth ladder end-to-end before any paying user exists.

---

## 17. ✅ Dashboard scope: minimal self-serve, `packages/dashboard` on Vercel (founder decision, 2026-07-10)

**Conclusion.** Phase 1 needs a self-serve human-facing surface — surfaced as a gap by `05-user-flows.md` Flows 2 & 4, since `03-phase1-architecture-plan.md`'s M5 milestone explicitly requires a "static-API-key issuance flow for headless use" and neither `mcp-server` nor `worker` should own human-facing HTTP (see `docs/rules/01-architecture.md` §1's package boundaries). Scope locked to the minimum that unblocks M5, not a full account-management product:

- AuthKit login (same tenant as the MCP OAuth flow — same OAuth-subject ID resolves to the same Postgres account row).
- Plan status, with a link-out to **Bachs's hosted checkout** for signup/upgrade, plus a **minimal in-house "cancel subscription" action** that calls Bachs's API directly. **Resolved 2026-07-10 (web search):** Bachs confirms hosted checkout and a full subscription lifecycle (cancel/upgrade/downgrade/pause) available via its Node/Python/Go SDKs, but no pre-built hosted customer-portal UI to link out to (unlike Stripe's Customer Portal) — so cancellation/plan-change UI is dashboard-owned, not outsourced to a Bachs-hosted page. Re-check Bachs's docs directly at M5 in case this has changed.
- Static API key generate / list / revoke, shown once on generation (standard API-key UX), per `05-user-flows.md` Flow 4.
- Quota display: remaining calls + reset date, mirroring `get_quota`'s output.

**Explicitly out of scope for Phase 1:** usage analytics/history, billing history UI, multiple labeled/scoped keys, team/multi-seat support. Add only if a real post-launch signal demands it — see `docs/rules/08-performance.md` §6's "what not to optimize prematurely" principle, applied here to product scope instead of infra.

**New package.** `packages/dashboard` — Next.js, deployed to **Vercel's free tier**, decoupled from the Hetzner worker fleet's uptime/scaling and consistent with the "generous free tier, easy to scale" vendor pattern already used for Upstash/Neon (`02` §16). It talks directly to Postgres (account/plan/key tables) and to AuthKit/Bachs — it does **not** route through `mcp-server`'s MCP protocol surface or the BullMQ queue, since it never touches the browser-render pipeline. `packages/shared` may still supply the account/plan type shapes it has in common with `mcp-server`, per the existing rule that `shared` is the only cross-package contract (`docs/rules/03-shared-contracts.md`).

**Founder decision, asked via `AskUserQuestion`:** scope = Minimal self-serve; hosting = new `packages/dashboard` on Vercel. Both chosen over a founder-manual/no-dashboard option (blocks self-serve launch, doesn't satisfy M5 as written) and a full-analytics dashboard (unjustified pre-revenue scope) for scope; and over Hetzner-hosted or mcp-server-embedded options (couples dashboard uptime to render infra, or violates the package-boundary rule) for hosting.

---

## Summary table — brief vs. recommendation

| Area           | Brief said                          | Recommendation                                                   | Δ    |
| -------------- | ----------------------------------- | ---------------------------------------------------------------- | ---- |
| Browser engine | Playwright                          | **Patchright** (Playwright-compatible), Camoufox optional        | ⚠️   |
| Stealth        | DC→residential on 403               | 4-rung cost-ordered ladder + block classifier                    | ✏️   |
| Telemetry moat | Abstract "fingerprint matrix"       | Concrete per-domain **routing memory** in Redis                  | ⚠️   |
| Concurrency    | 15 jobs/worker                      | Queue depth ~8–12, **render semaphore 3–4**                      | ⚠️   |
| Warm pool      | 1 browser, incognito contexts       | Keep + strict lifecycle + `BrowserProvider` abstraction          | ✅✏️ |
| Image          | WebP, 100–200KB                     | Keep + `sharp` downscale to ≤1568px + `detail` knob              | ✅✏️ |
| Tools          | view_page/inspect_ui/extract_assets | Keep + `get_quota`; thin stdio client                            | ✅   |
| Recycle        | every 250–500 req                   | Keep + time ceiling + zombie reaping + `/dev/shm`                | ✅✏️ |
| Runtime        | Node **or** Bun                     | **Node LTS** on workers                                          | ✏️   |
| Cost policy    | $0.002/run                          | Reliability-first + 3 hard caps (quota / per-req / global daily) | ✏️   |
| Cookies/auth   | Open question                       | **Defer out of MVP**                                             | ⚠️   |
| Security       | Implied                             | SSRF guard + egress isolation + auth = **MVP-blocking**          | ✏️   |
