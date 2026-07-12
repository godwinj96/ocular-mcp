# 05 — Ocular Phase 1: User Flows

**Purpose:** every distinct path a human or an agent takes through Ocular, end to end, so build order and requirements at each stage are unambiguous. Complements `03-phase1-architecture-plan.md` (the system's internals) with the *outside-in* view. Cross-references `docs/rules/` for the enforceable rule governing each stage.

**Two personas:**
- **The founder/subscriber** — a human who signs up, pays, manages their account, and configures an agent to use Ocular.
- **The agent** — the MCP client (Claude Desktop, Cursor, ChatGPT, Claude.ai, or a headless CI bot) that actually calls tools on the user's behalf.

---

## Flow 1 — First-time signup & OAuth connect (interactive client)

**Actor:** subscriber, using an MCP client with browser support (Claude Desktop, Cursor, Claude.ai).

```
1. User adds Ocular's remote MCP URL (mcp.ocular.dev) to their client's MCP server list.
2. Client discovers OAuth metadata (/.well-known/oauth-authorization-server) automatically — no manual config.
3. Client performs dynamic client registration (DCR) against AuthKit — self-registers, no pre-registration needed.
4. Client opens a browser redirect to AuthKit's hosted login.
5. User signs in with Google (or GitHub, if enabled) via AuthKit's upstream social connection.
6. AuthKit issues an MCP-scoped access token (audience = Ocular's resource identifier), redirects back to the client.
7. Client stores the token per its own convention (out of Ocular's control) and is now "connected."
8. First tool call: mcp-server verifies the JWT (04-mcp-server-and-auth.md §2) — but the account has
   no Postgres row yet unless signup included a plan selection. See Flow 2 for what happens next.
```

**Requirement surfaced:** the *first* tool call from a freshly-OAuth'd user who hasn't picked a plan must resolve to a clear `UNAUTHORIZED` with a message pointing them to complete signup/billing — not a confusing generic auth error. This is a dedicated error-message case to design, not just "reuse UNAUTHORIZED".

**Depends on:** `04-mcp-server-and-auth.md` (auth infra + pipeline), Flow 2 (billing).

---

## Flow 2 — Plan selection & billing signup

**Actor:** subscriber, via a web dashboard (not yet designed/built — tracked here as a requirement).

```
1. User lands on Ocular's marketing/dashboard site (separate from the MCP server itself).
2. User signs in (same AuthKit tenant, so the OAuth-subject ID matches what mcp-server will see later).
3. User selects a plan (the $1/mo tier; more tiers may come later — out of scope for Phase 1 to design more than one).
4. Dashboard creates a Bachs subscription/checkout session; user completes payment in Bachs's hosted flow.
5. Bachs fires a webhook (subscription.created / payment.succeeded) to Ocular's backend.
6. Backend upserts a Postgres row: { oauth_subject_id, bachs_customer_id, plan, quota_reset_at }.
7. User is now able to successfully call tools (Flow 1 step 8 resolves).
```

**Requirement surfaced:** a **dashboard** is an implicit Phase 1 dependency not called out as its own package in `03-phase1-architecture-plan.md` §1 — it's where signup, plan selection, static-key issuance (Flow 4), and quota/usage viewing all live. Either build a minimal one (even a single hosted-checkout-link page) or explicitly scope it into an early milestone. **Open question — needs a decision before M5.**

**Depends on:** `11-billing-and-quota.md` (Bachs↔Postgres↔Redis sync).

---

## Flow 3 — Steady-state tool call (the core product loop)

**Actor:** the agent, already connected (Flow 1 complete, plan active).

```
1. Agent decides to call view_page({ url, detail, full_page }) mid-conversation.
2. mcp-server pipeline runs (04-mcp-server-and-auth.md §3): verify -> validate -> SSRF pre-check ->
   quota check -> enqueue -> await.
3. worker pipeline runs (05-worker-and-browser-pipeline.md §1): semaphore -> SSRF authoritative check ->
   routing memory -> stealth ladder -> extractor -> image pipeline.
4. Result: WebP image + meta text returned as MCP content blocks. Agent continues its task with the image
   in context.
5. Quota decremented per 11-billing-and-quota.md §0 (full charge on CLEAN, half on exhausted failure,
   none if rejected before enqueue).
```

**This is the flow that must work end-to-end first — it's M1 (Vertical slice) in `03-phase1-architecture-plan.md` §10.** Every other flow either sets up the preconditions for this one (auth, billing) or handles what happens when it doesn't go cleanly (Flows 5–7).

---

## Flow 4 — Headless/CI static API key issuance and use

**Actor:** subscriber (issuance) then an unattended agent (use) — no browser available for OAuth.

```
Issuance (subscriber, via dashboard — same dashboard as Flow 2):
1. User navigates to "API Keys" in the dashboard (requires an active plan — Flow 2 complete).
2. User clicks "Generate key." Backend mints a static key, stores a hash + metadata in Postgres
   linked to the same account row as their OAuth subject.
3. Key is shown ONCE in the UI (copy-to-clipboard pattern, like most API key UX) — never retrievable again,
   only revocable/regeneratable.
4. User pastes the key into their headless client's config (Authorization: Bearer <key>).

Use (unattended agent):
1. Agent calls a tool with Authorization: Bearer <static-key>.
2. mcp-server verifies via Postgres lookup (04-mcp-server-and-auth.md §2), no AuthKit round-trip.
3. Same pipeline as Flow 3 from here on — the tool handler never knows which auth method was used.
```

**Requirement surfaced:** key rotation/revocation UX (dashboard: "Revoke" + "Generate new") and the fact that a revoked key must take effect immediately (no cached "verified" state lingering past a short TTL) — see `04-mcp-server-and-auth.md` §2's in-process cache note.

---

## Flow 5 — Tool call hits a stealth wall (escalation, still succeeds)

**Actor:** the agent, transparent to it — this flow is invisible from the outside except for latency.

```
1. Rung 0 (datacenter proxy) navigation -> BlockClassifier verdict: CHALLENGE.
2. Context closed. Budget check: within MAX_ESCALATIONS and deadline remaining -> escalate to Rung 1.
3. Rung 1 (residential proxy) navigation -> BlockClassifier verdict: CLEAN.
4. Routing memory updated: "domain X: Rung 1 OK" (next request to this domain starts at Rung 1, not Rung 0).
5. Extractor + image pipeline run normally. Full charge applied (CLEAN, regardless of which rung).
6. meta.rungReached = 1 is available to the agent/dashboard for transparency, but does not change the
   response shape or the charge.
```

No user-visible difference from Flow 3 except latency — this is intentional (see `01-architecture.md` §0, reliability-first policy).

---

## Flow 6 — Tool call exhausts the ladder (half-charge failure)

**Actor:** the agent.

```
1. Rungs 0..maxRung all return CHALLENGE/HARD_BLOCK/EMPTY (or Rung 3's UnblockerClient also fails).
2. Ladder gives up. worker builds a FailureEnvelope: { ok: false, reason: 'BLOCKED', rungReached: maxRung }.
3. mcp-server maps this to an MCP tool error with a human-readable message (09-error-handling-and-logging.md §2)
   — e.g. "This site blocked automated access after trying multiple approaches."
4. Quota: half charge (0.5) applied — 11-billing-and-quota.md §0.
5. Agent sees a clear failure and can decide whether to retry, try a different URL, or give up —
   Ocular does not auto-retry beyond what the ladder already did.
```

**Requirement surfaced:** the agent-facing error message should hint at *why* without leaking internals — e.g. distinguishing "the site's anti-bot system blocked us" (`BLOCKED`) from "the site itself was down" (`UPSTREAM_5XX`) so the agent can make a sensible next decision (retry vs. abandon).

---

## Flow 7 — Quota exhausted mid-conversation

**Actor:** the agent (and, indirectly, the user watching the conversation).

```
1. Agent calls a tool. mcp-server's atomic quota check (11-billing-and-quota.md §2) finds the account
   at/over its monthly cap.
2. Rejected BEFORE enqueue: QUOTA_EXCEEDED, no charge, no worker involvement.
3. Agent receives a clear MCP error. A well-behaved agent surfaces this to the user
   ("Ocular's monthly quota is exhausted — upgrade or wait for reset on <date>").
4. User can call get_quota() at any time (own tool, no charge) to check remaining calls before this
   happens — this is why get_quota exists as a first-class tool rather than an afterthought.
```

**Requirement surfaced:** `get_quota`'s response should include the reset date so an agent (or the user reading the agent's summary) knows when the cap lifts, not just the remaining count — confirm this is in the tool's output schema when built (`01-architecture.md` §4 table).

---

## Flow 8 — OAuth token expiry mid-session

**Actor:** the agent, transparent to the user in a spec-compliant client.

```
1. Agent's cached AuthKit access token expires (short-lived by OAuth design).
2. Next tool call: mcp-server's JWT verification fails on expiry -> returns 401 + WWW-Authenticate header
   pointing at the resource metadata URL (spec requirement, 04-mcp-server-and-auth.md §2).
3. A spec-compliant MCP client silently re-initiates the OAuth flow (or uses a refresh token if the
   client implements one) without user-visible friction.
4. A non-compliant client may instead surface a visible re-auth prompt — this is a client-side gap,
   not something Ocular can control, but worth documenting in the "known-good client list"
   (03-phase1-architecture-plan.md §10, M9).
```

---

## Flow 9 — Subscription cancellation / payment failure

**Actor:** subscriber (cancels) or Bachs (payment fails) — backend-driven either way.

```
1. Bachs fires subscription.canceled or payment.failed webhook.
2. Backend updates the Postgres account row: plan -> null/inactive (do not delete the row — keep it
   for historical/audit purposes and to distinguish "never subscribed" from "subscription lapsed").
3. Next tool call from that account: resolve-account.ts finds an inactive plan -> UNAUTHORIZED
   (same fail-closed rule as Flow 1's "no account row" case, 11-billing-and-quota.md §3).
4. Existing static API keys remain in Postgres but stop authorizing (checked against the same
   plan status) — no separate revocation step needed, they just start failing closed.
```

**Requirement surfaced:** the `UNAUTHORIZED` message for "was active, now lapsed" should differ from "never signed up" if feasible, since it changes what the user needs to do next (reactivate vs. sign up) — nice-to-have, not MVP-blocking; document as a fast-follow if not done in Phase 1.

---

## Flow 10 — Adding a new MCP client mid-flight (multi-client use)

**Actor:** subscriber who wants to use Ocular from a second client (e.g., already using Claude Desktop, now adding Cursor).

```
1. User adds Ocular's URL to the second client.
2. Client performs its OWN dynamic client registration and OWN OAuth flow (Flow 1 steps 2-6) —
   DCR means no per-client pre-registration burden on Ocular's side.
3. Both clients now hold independently-issued tokens for the SAME AuthKit user/account —
   they share one quota pool (keyed by account, not by client/token).
```

**Requirement surfaced:** confirm quota keying is by `accountId`, never by token/session — this is implicit in `03-shared-contracts.md` §1's `OcularJob.account` shape but worth stating explicitly here since it's easy to get wrong (e.g., keying by JWT `sub` claim vs. the resolved Postgres account ID could silently create two quota pools if the mapping isn't 1:1).

---

## Open questions this file surfaces

1. ~~**Dashboard scope** (Flow 2, Flow 4)~~ — **Resolved 2026-07-10**: minimal self-serve `packages/dashboard` on Vercel, built as part of M5. See `02` §17.
2. **Lapsed vs. never-subscribed error messaging** (Flow 9) — nice-to-have distinction, not MVP-blocking. Tracked in `04-open-questions.md`.
3. **Known-good client list** (Flow 8) — needs real-world testing against Claude Desktop/Cursor/ChatGPT/Claude.ai's actual OAuth+remote-MCP support before launch (M9).

---

*Flows v1.0 · 2026-07-10 · Ocular Phase 1*
