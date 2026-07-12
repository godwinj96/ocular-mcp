# 03 — Ocular Phase 1: Core Architecture & Implementation Plan

**Audience:** the engineer(s) or model building Phase 1. This is the blueprint to execute. It assumes the decisions in `02`. Where a number is a starting guess, it says so — tune against real telemetry.

**Goal of Phase 1:** ship the `$1/mo` **Vision MCP server** + its cloud stealth-render backend. An agent calls a tool with a URL; Ocular returns an optimized WebP screenshot and/or a compact design-token/asset blueprint, bypassing common anti-bot walls, within a 10s budget, at <$0.002 server cost on the happy path.

> **Revision note (2026-07-10, post-founder review):** Transport/auth architecture changed from "local stdio shim + copy-pasted API key" to **remote Streamable-HTTP MCP server with OAuth 2.1** via a hosted authorization provider (WorkOS AuthKit), with local stdio explicitly deferred. Billing moved to Bachs. Hosting confirmed as Hetzner EU. See `02` §12–15 for the rationale.

---

## 0. TL;DR architecture

```
┌────────────────────┐  Streamable HTTP (MCP)  ┌──────────────────────────┐
│ Dev IDE / Agent    │◄───────────────────────►│ Ocular MCP Server (Node) │  stateless, N replicas
│ (Cursor/Claude/     │   Bearer: <AuthKit JWT>  │  - verify AuthKit token  │
│  ChatGPT/Claude.ai) │                          │  - serve tools/list,     │
└─────────┬───────────┘                          │    tools/call over MCP  │
          │ browser redirect                      │  - SSRF pre-check       │
          ▼                                       │  - quota check (Redis)  │
┌────────────────────┐                            │  - enqueue + await      │
│ WorkOS AuthKit     │  issues MCP-scoped tokens   └───────────┬──────────┘
│ (OAuth 2.1 + PKCE  │  "Sign in with Google" etc.             │ BullMQ
│  + dyn. client reg)│                                         ▼
└────────────────────┘                             ┌────────────────────┐
                                                    │ Redis              │  queue + quota + routing memory
                                                    └─────────┬──────────┘
                                                              │
                                    ┌─────────────────────────┴─────────────────────────┐
                                    ▼                                                     ▼
                         ┌────────────────────┐                                ┌────────────────────┐
                         │ Worker VPS #1      │  Hetzner, EU        …          │ Worker VPS #N      │
                         │  BullMQ consumer   │                                │                    │
                         │  render semaphore  │                                │                    │
                         │  BrowserProvider ──┼──► Patchright/Chrome (warm)    │                    │
                         │  StealthLadder ────┼──► DC → Residential → Unblocker│                    │
                         │  sharp (WebP)      │                                │                    │
                         └────────────────────┘                                └────────────────────┘

Billing (async, off the hot path): Bachs (subscriptions/usage/tax/settlement)
  --webhooks--> Postgres (account ↔ plan ↔ OAuth-subject mapping) <--read-- MCP Server (quota/plan lookups)
```

**Why remote+OAuth instead of local stdio:** (1) it's the spec-compliant way to expose an internet-reachable MCP server as of the November-2025 MCP revision; (2) it reaches **web-based agent surfaces** (ChatGPT, Claude.ai) that only support remote MCP, not stdio — directly serving the brief's "Autonomous Web Task Agents" persona; (3) it removes the token-in-a-config-file leak risk that pushed Supabase's own MCP server off copy-pasted PATs. A static API key (via `Authorization: Bearer <key>`) remains as a fallback path for headless/CI/unattended-agent use where no browser exists for the OAuth flow. **Local stdio packaging is deferred — see §13.**

---

## 1. Repository & service layout

Monorepo (npm workspaces — see `docs/rules/02-repo-structure.md` §5):

```
ocular/
├── packages/
│   ├── mcp-server/          # the internet-facing service: OAuth-verified, serves MCP over Streamable HTTP
│   ├── worker/               # BullMQ consumer + browser pipeline
│   ├── dashboard/             # human-facing surface: login, API keys, billing links, quota (Next.js, Vercel)
│   └── shared/                # types, Zod schemas, result envelope, constants
├── infra/                     # Dockerfiles, compose, provisioning notes
└── research & planning/       # (this directory)
```

`shared` is the contract between `mcp-server`, `worker`, and `dashboard`: tool input schemas, the **result envelope**, error codes, and the job payload type. `dashboard` was added 2026-07-10 as a founder decision (`02` §17) — it's the self-serve surface for plan/billing status, static API key issuance, and quota viewing, kept deliberately minimal for Phase 1 (see `05-user-flows.md` Flows 2 & 4). It talks directly to Postgres/AuthKit/Bachs and never touches the MCP protocol surface or the render pipeline.

`mcp-server` absorbs what would have been a separate "API gateway" — there is no longer a local shim proxying to a backend; the internet-facing service *is* the MCP server. Internally it still separates concerns (auth middleware → MCP handler → quota/SSRF → enqueue), just as one deployable.

---

## 2. The public contract (define this FIRST)

### 2.1 Tools (MCP surface, unchanged by the transport shift)

| Tool | Input (Zod) | Returns |
|------|-------------|---------|
| `view_page` | `{ url, detail?: 'low'\|'balanced'\|'high', full_page?: boolean, viewport?: {w,h} }` | `image` (WebP) + short `text` meta (final URL, dimensions, rung used) |
| `inspect_ui` | `{ url, detail? }` | `image` (WebP) + `text` JSON design-token blueprint |
| `extract_assets` | `{ url, include?: ('svg'\|'img'\|'icons')[] }` | `text` JSON: inline SVGs + absolute asset URLs |
| `get_quota` | `{}` | `text`: remaining calls, reset date, plan |

Keep them as four separate tools (not one tool with a mode flag) so the agent's token cost matches its intent.

### 2.2 Result envelope (in `shared`)

```
Success: { ok: true,  meta: {...}, image?: {b64, mime, w, h, bytes}, data?: {...} }
Failure: { ok: false, reason: <ErrorCode>, message, rung_reached, partial?: {...} }
```

`ErrorCode` is a closed enum (`BLOCKED`, `TIMEOUT`, `INVALID_URL`, `SSRF_BLOCKED`, `QUOTA_EXCEEDED`, `UPSTREAM_4XX`, `UPSTREAM_5XX`, `RENDER_ERROR`, `BUDGET_EXHAUSTED`, `UNAUTHORIZED`). This is what an MCP tool error's message is built from — never a raw stack trace.

### 2.3 Charge policy (locked)

- A render that reaches `CLEAN` (any rung) → **full charge (1 call)** against monthly quota.
- A render that exhausts the stealth ladder (including the paid fallback, if attempted) and still fails → **half charge (0.5 call)**. It consumed proxy/compute; the user gets a discount, not a refund.
- Quota is a float counter in Redis for this reason; round for display only.
- Abuse of the leniency (hammering unblockable URLs) is caught by **per-key rate limiting** (§5), which is independent of the monthly quota.

---

## 3. Component specs

### 3.1 MCP Server (`packages/mcp-server`) — the internet-facing OAuth resource server

This is the one deployable that speaks MCP to the outside world. Framework: Fastify (schema support, throughput) with the official `@modelcontextprotocol/sdk`'s **Streamable HTTP** transport.

**Auth setup (do this first, it's infra not code):**
1. Create a WorkOS AuthKit tenant/project for Ocular.
2. Configure Ocular's MCP server as the **protected resource** in AuthKit (per MCP's Protected Resource Metadata spec) — this is what lets AuthKit issue tokens correctly scoped/audienced to Ocular rather than a generic AuthKit token.
3. Enable **dynamic client registration** (and Client ID Metadata Document per the Nov-2025 spec) so Claude Desktop/Cursor/ChatGPT/Claude.ai can self-register as OAuth clients without you pre-registering each one.
4. Add **Google** (and optionally GitHub) as upstream social connections inside AuthKit — this is the login screen end users see; AuthKit remains the actual authorization server issuing the MCP-scoped access token.
5. AuthKit publishes the standard OAuth metadata endpoints (`/.well-known/oauth-authorization-server`, JWKS, etc.) that MCP clients discover automatically per spec — no custom discovery code needed on Ocular's side.

**Per-request responsibilities:**
1. **Verify the bearer token** on every MCP request: validate signature against AuthKit's JWKS, check `aud` matches Ocular's resource identifier, check expiry. Cache JWKS with standard rotation handling. On failure → MCP-level auth error (spec requires `WWW-Authenticate` with the resource metadata URL so the client can (re-)initiate OAuth).
2. **Fallback path**: also accept `Authorization: Bearer <static-api-key>` for headless/CI use — these keys are minted from the dashboard (backed by Bachs-linked accounts), checked against the Postgres account table directly (no AuthKit round-trip), and are the only path for unattended agents.
3. **Resolve token/key → account → plan** (cached briefly in-process).
4. **SSRF pre-check** (§5) on the URL argument before enqueue.
5. **Quota check** (atomic Redis op per §2.3/§8): reject `QUOTA_EXCEEDED` before enqueue if the account is at its cap.
6. **Enqueue** a BullMQ job `{ tool, args, account, requestId, deadlineMs }`. `attempts: 1` — the stealth ladder handles retries internally, not BullMQ.
7. **Await** job completion with a server-side timeout (~12s) longer than the worker's 10s job deadline; on timeout return `TIMEOUT`.
8. Map the result envelope to MCP tool-call content blocks (image + text) or an MCP error, and respond over the Streamable HTTP connection.

Scaling: stateless aside from short-lived in-process caches → run ≥2 replicas behind a load balancer. All durable state is in Redis (hot path) and Postgres (accounts/billing, warm path).

### 3.2 Worker (`packages/worker`) — unchanged from the original plan

One process per worker VPS (Hetzner, EU, 4vCPU/8GB to start). On boot:
- Launch **one** Patchright/Chrome instance (warm), via `BrowserProvider`.
- Start a BullMQ `Worker` with concurrency `QUEUE_CONCURRENCY` (start 8).
- Initialize the **render semaphore** (start 4) — every page render acquires it first.
- Register lifecycle counters for recycle logic.

Per-job pipeline (all inside a `try/finally` that guarantees context teardown):

```
1. acquire render semaphore
2. SSRF full check (resolve DNS, block private/meta ranges, per-hop) — authoritative re-check
3. routing memory lookup → starting rung R for this domain
4. StealthLadder.run(url, startRung=R):
   for rung in [R .. maxRung]:
     a. provider.newContext(rungProfile)   # fresh incognito context + proxy for the rung
     b. page = context.newPage()
     c. navigate(url, waitUntil: 'domcontentloaded', deadline)
     d. smartWaitAndScroll(page, deadline)  # auto-scroll, bounded settle
     e. verdict = blockClassifier(page, response)
     f. if verdict == CLEAN: break (record success rung in routing memory)
        else: close context; if rung < maxRung and budget allows: escalate; else fail
5. run tool-specific extractor(s) on the good page:
     - view_page:      screenshot buffer
     - inspect_ui:     screenshot + inject design-token extractor (page.evaluate)
     - extract_assets: inject asset extractor (SVG + absolute-URL rewrite)
6. imagePipeline(buffer): sharp resize→WebP→ensure ≤ target KB
7. build success envelope (or exhausted-ladder failure envelope, per §2.3); wipe buffers
finally:
   - close page & context (always)
   - release semaphore
   - bump request counter; if >= recycle threshold, trigger browser recycle
```

Timeouts: a single monotonic **deadline** (`Date.now() + 10_000`) is threaded through every step. Never start a rung that can't finish before the deadline.

### 3.3 `BrowserProvider` interface (the abstraction / escape hatch)

```
interface BrowserProvider {
  init(): Promise<void>
  newContext(profile: RungProfile): Promise<BrowserContext>   // proxy, UA, viewport, locale
  recycle(): Promise<void>                                     // drain + relaunch
  health(): ProviderHealth
  dispose(): Promise<void>
}
```

- `SelfHostedProvider` (Phase 1 default): wraps Patchright; owns the warm Chrome, applies per-rung proxy + fingerprint profile at `newContext`.
- `ManagedBrowserProvider` (stub, later): points `newContext` at a managed browser endpoint (CDP over WebSocket). Same interface → the pipeline never changes.
- Rung-3 (commercial unblocker) is **not** a `BrowserProvider`; it's a separate `UnblockerClient` the ladder calls when browser rungs are exhausted, since it returns rendered HTML/screenshot via HTTP, not a live page.

### 3.4 StealthLadder & BlockClassifier

- **RungProfile** bundles: proxy pool (dc/residential), a coherent fingerprint (UA + viewport + platform + locale + timezone that all agree), and humanization params.
- **Humanization** (Rung 0+): small randomized mouse movements, variable scroll velocity, realistic `Accept-Language`, timezone matched to proxy geo.
- **BlockClassifier** returns `CLEAN | CHALLENGE | HARD_BLOCK | EMPTY`, from HTTP status, response headers (`cf-mitigated`, `server`), Turnstile/challenge DOM markers, `<title>` patterns, and an "is the render substantively empty?" heuristic.

### 3.5 Extractors (the product IP)

Injected via `page.evaluate`, returning compact JSON — **never raw stylesheets**:

- **Design-token extractor (`inspect_ui`)**: `:root` custom properties; sampled `getComputedStyle` across visible elements → deduplicated color palette, typography scale, spacing rhythm, radius/shadow tokens, detected breakpoints. Cap output size per category.
- **Asset extractor (`extract_assets`)**: inline `<svg>` (serialized, size-capped); rewrite relative `src`/`srcset`/CSS `url()` to absolute public URLs. Public http(s) only (SSRF-safe). Anchors, not hosted files.

### 3.6 Image pipeline (`sharp`)

Screenshot buffer → if long edge > ceiling (default 1568px, or per `detail`) resize down (Lanczos) → encode WebP (start quality 75) → step quality/dimensions down until ≤200KB or a floor is hit. Return `{b64, mime, w, h, bytes}`. Free the raw buffer immediately.

---

## 4. Request lifecycle (end-to-end, happy path)

1. Agent's MCP client (already OAuth-connected to `mcp.ocular.dev`, or using a static key) calls `view_page({url})` over Streamable HTTP.
2. `mcp-server` verifies the bearer token, SSRF-prechecks, atomically decrements quota, enqueues, awaits.
3. Worker pulls job, acquires render semaphore, resolves routing memory → starts at Rung 0.
4. Fresh context (DC proxy + coherent fingerprint) → navigate → smart-scroll → BlockClassifier says CLEAN.
5. Screenshot → `sharp` → WebP ≤200KB. Success envelope built; routing memory notes "domain X: Rung 0 OK".
6. Context closed, semaphore released, counters bumped. Envelope returns through `mcp-server` as MCP content blocks to the agent.

Target happy-path budget: P50 under ~4–6s, P95 under the 10s ceiling.

---

## 5. Security (MVP-blocking — build in from day one)

- **Token verification**: every request's bearer token (AuthKit JWT or static key) is verified before any tool logic runs. JWT: signature via AuthKit JWKS, `aud` check, expiry. Static key: DB lookup, revocable, no expiry by default but rotatable.
- **SSRF**: allowlist `http`/`https` only; reject `file:`, `data:`, `ftp:`, etc. Resolve the hostname and **reject if any resolved IP is** private (RFC1918), loopback, link-local (`169.254/16`, incl. `169.254.169.254` metadata), ULA/`fc00::/7`, or `::1`. Re-check on **every redirect hop**. Checked at `mcp-server` (fast reject) *and* the worker (authoritative — DNS can rebind between checks).
- **Egress isolation**: worker nodes get no network path to Redis-internal admin, `mcp-server` admin, or cloud metadata endpoints beyond necessity.
- **Rate limiting**: per-account/per-key short-window limit, independent of the monthly quota (this is what backstops the success/half-charge policy against abuse).
- **Input hygiene**: everything arriving is untrusted (LLM-authored tool args). Zod-validate at `mcp-server`.
- **Output hygiene**: extractors emit only public URLs; cap sizes to avoid a malicious page ballooning the response.
- **Secrets**: proxy creds, unblocker keys, AuthKit signing keys, Bachs webhook secret, DB/Redis URLs via env/secret manager only.

---

## 6. Known bottlenecks & how the plan addresses each

| Bottleneck | Why it hurts | Mitigation in this plan |
|-----------|--------------|-------------------------|
| Chromium RAM growth | Worker OOM, crashes mid-render | 1 browser/worker, render semaphore 3–4, scheduled recycle (N req or M min), fresh context always closed |
| `/dev/shm` exhaustion in Docker | Silent Chromium crash + zombie | Size `/dev/shm` up; `tini` PID1 reaping; health check restarts |
| Navigation/scroll latency | Blows 10s budget | Single threaded deadline; `domcontentloaded` + bounded smart-scroll, not `networkidle` alone |
| Proxy bandwidth burn | Kills unit economics | DC-first ladder, evidence-driven escalation, routing memory, 15–20% buffer in cost model |
| Paid unblocker cost | ~$0.0015/call ≈ 75% of run budget | Rung 3 only after browser rungs fail; per-request 1-call ceiling; global daily budget circuit breaker |
| Vision token bloat | Dev pays; hurts adoption | `sharp` downscale to ≤1568px, WebP q75, ≤200KB, `detail` knob |
| Redis as SPOF | Queue+quota+routing memory all on it | Managed Redis w/ persistence; degrade gracefully (routing memory down → start at Rung 0; quota down → fail closed) |
| OAuth client fragmentation | Some MCP clients don't yet handle remote+OAuth cleanly | Static API-key fallback path always available; document known-good clients at launch |
| BullMQ retry vs. budget | External retries multiply cost/latency | `attempts:1`; retries live inside the ladder under the deadline |

---

## 7. Edge cases the implementer must handle

- **Infinite-scroll pages**: cap scroll iterations and total scroll time; capture what loaded within budget; note truncation in meta.
- **Pages that never fire `networkidle`**: rely on `domcontentloaded` + settle timer, not idle.
- **Redirect chains / URL shorteners**: follow with per-hop SSRF re-check; cap hop count.
- **Non-HTML responses** (PDF, direct image, JSON, download): detect content-type; return a graceful `RENDER_ERROR` rather than screenshotting a download dialog.
- **Giant DOM / heavy SPA**: extractor sampling must be bounded (cap elements walked) to avoid `page.evaluate` timeouts.
- **Cookie/consent walls & interstitials**: optional best-effort auto-dismiss of common consent frames before capture; time-boxed, never blocks success.
- **Timeouts mid-render**: `finally` must close context/page even when the deadline aborts.
- **Worker crash mid-job**: BullMQ job becomes `failed`/stalled → `mcp-server` returns `TIMEOUT`/`RENDER_ERROR`; nothing is charged if no envelope was produced.
- **Quota race** (parallel calls near the limit): atomic Redis op, not read-then-write.
- **Very tall full-page screenshots**: cap height; segment or refuse beyond a max.
- **Unicode/IDN & punycode URLs**: normalize before SSRF checks.
- **Duplicate concurrent requests to same URL**: optional short-TTL in-flight de-dupe/coalesce (nice-to-have).
- **Browser recycle during active jobs**: drain — new contexts route to the standby browser.
- **OAuth token expiry mid-session**: MCP client should silently refresh per spec; `mcp-server` returns a spec-correct 401 + `WWW-Authenticate` pointing at resource metadata so compliant clients can re-auth without user friction.
- **AuthKit/DB divergence**: an AuthKit-authenticated user with no matching Postgres account row (e.g., webhook lag from Bachs) → treat as `UNAUTHORIZED`/no-plan rather than defaulting to any quota.

---

## 8. Tradeoffs made (state them so they're revisitable)

- **Remote HTTP + OAuth over local stdio**: better reach (web agents) and spec-compliant, but real infra (AuthKit tenant, token verification) and some near-term client-support fragmentation risk. Static-key fallback covers headless use and de-risks the fragmentation.
- **Patchright over nodriver**: accept a small residual block rate (covered by paid fallback) to keep the Node/TS stack and avoid AGPL.
- **Base64 image in JSON** over binary/multipart: simpler MVP; ~33% wire overhead. Acceptable at ≤200KB payloads.
- **Reliability-first + half-charge-on-failure**: better UX and fairer billing, slightly more complex quota accounting (float counters) than a flat per-call charge.
- **Self-hosted warm pool**: cheapest per render, more ops burden. The `BrowserProvider` abstraction buys an exit to managed browsers if ops cost dominates.
- **Defer cookies/auth**: lose a marquee feature at launch to avoid a serious security liability; ship faster and safer.
- **Node over Bun on workers**: give up Bun's speed for native-addon stability with Playwright/`sharp`.
- **Bachs over Stripe**: broader payment-method/geo reach for a global indie audience at the cost of a less battle-tested integration ecosystem than Stripe's.

---

## 9. Observability & cost accounting (build minimal from the start)

Emit structured logs + metrics per job: `requestId`, domain, tool, **rung reached**, block verdict, proxy bytes used, wall-time per stage, payload KB, outcome, charge applied (1 / 0.5 / 0). Aggregate:
- **Success rate by rung and by domain** (drives routing-memory tuning and finds newly-hard sites).
- **Rung-3 (paid) call rate and spend** (guards the budget circuit breaker).
- **P50/P95 latency** and **per-run cost estimate** vs the $0.002 target.
- **Worker RSS + recycle events** (catch memory regressions early).
- **OAuth vs. static-key traffic split** (tells you whether the OAuth path is actually being adopted by clients or everyone's falling back to keys).

---

## 10. Build order (suggested milestones)

1. **M0 — Contract + auth infra**: `shared` package (Zod schemas, envelope, error codes, job payload). Stand up WorkOS AuthKit tenant, register Ocular as protected resource, enable DCR + CIMD, add Google connection. Stand up Postgres (account/plan/OAuth-subject table) and a Bachs sandbox account.
2. **M1 — Vertical slice, no stealth**: `mcp-server` (Streamable HTTP, token verification, `view_page` only) → worker (vanilla context render → `sharp` WebP) → image back to a real MCP client (Claude Desktop or an MCP inspector tool). Prove the OAuth-connect → tool-call → image loop end-to-end on an easy site.
3. **M2 — Warm pool + lifecycle**: Patchright provider, render semaphore, recycle, `/dev/shm`/zombie handling, 10s deadline plumbing, `BrowserProvider` interface.
4. **M3 — Stealth ladder**: DC proxy, block classifier, residential escalation, routing memory in Redis, humanization.
5. **M4 — Remaining tools**: `inspect_ui` (design tokens), `extract_assets`, `get_quota`.
6. **M5 — Guardrails + billing**: quota (with charge-on-success/half-charge-on-failure), per-key rate limit, per-request paid ceiling, global daily budget circuit breaker, Bachs subscription webhooks → Postgres sync, and `packages/dashboard` (minimal scope per `02` §17: AuthKit login, plan status + Bachs checkout/portal links, static-API-key issuance/revocation flow for headless use, quota display).
7. **M6 — Security hardening pass**: full SSRF (resolve-time + per-hop), egress isolation, secret management review, red-team the URL input and the token-verification path.
8. **M7 — Paid fallback**: `UnblockerClient` (Rung 3) behind the ceiling + budget breaker.
9. **M8 — Observability + load test**: metrics, dashboards, soak test a worker to validate recycle/memory, measure real per-run cost against $0.002.
10. **M9 — Launch polish**: docs for "point your client at `mcp.ocular.dev` and authorize," known-good client list, Hetzner EU fleet provisioning.

Ship M1–M6 to a private beta; M7–M9 harden for public launch.

---

## 11. Starting configuration constants (tune, don't trust)

| Const | Start value | Notes |
|-------|-------------|-------|
| `RENDER_CONCURRENCY` | 4 | simultaneous pages/browser on 4vCPU/8GB |
| `QUEUE_CONCURRENCY` | 8 | BullMQ jobs pulled; gated by semaphore |
| `JOB_DEADLINE_MS` | 10000 | hard per-request budget |
| `SERVER_AWAIT_MS` | 12000 | > job deadline |
| `BROWSER_RECYCLE_REQUESTS` | 300 | or… |
| `BROWSER_RECYCLE_MINUTES` | 30 | whichever first |
| `IMG_MAX_EDGE_PX` | 1568 | strictest common vision cap |
| `IMG_WEBP_QUALITY` | 75 | step down to hit KB target |
| `IMG_MAX_KB` | 200 | brief's ceiling |
| `MAX_ESCALATIONS` | 2 | rungs beyond start |
| `MONTHLY_QUOTA` | 300 | per the brief |
| `SUCCESS_CHARGE` | 1.0 | quota units per clean render |
| `EXHAUSTED_FAILURE_CHARGE` | 0.5 | quota units per fully-escalated failure |
| `DAILY_PAID_BUDGET_USD` | set low | circuit breaker |
| `JWKS_CACHE_TTL_S` | 600 | AuthKit key rotation tolerance |

---

## 12. Definition of done (Phase 1)

- A user can point a supporting MCP client at Ocular's remote URL, authorize via Google through AuthKit's browser flow in <60s, and get a `view_page` WebP back into their agent's context.
- Headless/CI use works via a dashboard-issued static API key.
- All four tools functional; failures are structured and legible; charge policy (1.0 / 0.5 / 0) applied correctly.
- Happy-path server cost measured ≤ ~$0.002/run; P95 latency ≤ 10s.
- Stealth ladder + routing memory demonstrably passes a basket of Cloudflare-protected test sites; paid fallback covers the tail and is budget-capped.
- Worker fleet (Hetzner EU) survives a multi-hour soak (recycle works; no unbounded RSS growth).
- Token verification, SSRF, quota, and rate limiting verified by test. Bachs subscription state correctly gates quota. Cookie/auth feature explicitly documented as out-of-scope for now.

---

## 13. Deferred: local stdio packaging

Not built in Phase 1. Tracked as a fast-follow for clients that don't yet support remote+OAuth MCP servers well. When picked up: a thin `npx`-installed package that holds a long-lived static API key (or performs the OAuth flow locally and caches the token), and proxies `tools/call` over stdio to the same `mcp-server` HTTP endpoint. No new backend work — it's a client-side bridge only, so it can be added without touching `worker` or the contract in `shared`.
