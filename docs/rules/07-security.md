# Ocular — Security Rules

**Section 7 of 13 · Always Apply**

> These are MVP-blocking, not later hardening (per `research & planning/03` §5). None of these ship as a TODO.

---

## 0. Security posture

Ocular's function is to fetch arbitrary attacker-influenced URLs on behalf of untrusted callers (LLM-authored tool args) and return the result. The threat model is: **the URL argument is hostile, the requesting agent's args are hostile, and the fetched page's content is hostile.** Three axioms:

1. **Never trust input** — validate and sanitize everything from every source (tool args, fetched page content, redirect targets, extractor output).
2. **Fail closed** — any ambiguity in auth, SSRF resolution, or quota → deny.
3. **Least privilege** — `worker` nodes get no network path to anything beyond what rendering requires.

---

## 1. Token verification

Covered fully in `04-mcp-server-and-auth.md`. Summary rule: every request's bearer token (AuthKit JWT or static key) is verified before any tool logic runs, with no bypass path.

---

## 2. SSRF — the highest-severity risk in this system

Ocular is, by design, a service that makes HTTP requests to attacker-chosen URLs. **This section governs the cloud path only.** The local path has a different threat model and a deliberately different rule — see `13-local-worker-and-distribution.md` §1 before assuming an inconsistency.

On the cloud path this is checked **twice**, at two different trust levels:

```
mcp-server (fast, non-authoritative pre-check, before enqueue):
  - Reject non-http(s) schemes: file:, data:, ftp:, javascript:, etc.
  - Resolve hostname; reject if any resolved IP is private (RFC1918), loopback,
    link-local (169.254/16, incl. 169.254.169.254 cloud metadata), or ULA (fc00::/7)
  - Purpose: reject obviously-bad input before it costs a queue slot

worker (authoritative, on every render — the one that's actually trusted):
  - Re-resolve at fetch time — DNS can rebind between the pre-check and the render
  - Re-check on EVERY redirect hop, not just the initial URL
  - This check is what StealthLadder.run() gates on before navigating
```

**Rule:** the worker-side check is never skipped because `mcp-server` already passed the URL — treat the pre-check purely as an optimization to save a queue slot, never as sufficient on its own.

**Rule:** IDN/punycode/Unicode URL normalization happens _before_ the first resolution attempt in both checks — normalize-then-check, never check-then-normalize.

**Rule — the cloud check is never relaxed.** `packages/local-worker` permits private IPs because reaching localhost on the user's own machine crosses no privilege boundary. That allowance is implemented as a **separate, explicitly-named code path in `local-worker`** — never as a flag, environment toggle, or conditional inside `packages/worker/src/ssrf/authoritative-check.ts`. If you find yourself adding a parameter that makes the cloud SSRF check skippable, stop: that is the wrong design, and it is how this guarantee gets silently lost. `local-worker` still blocks cloud-metadata ranges (169.254.169.254 and equivalents) in case it is running on a VPS.

---

## 3. Egress isolation

Worker nodes have no network path to: Redis admin/management ports, `mcp-server`'s internal admin surface (if any), or cloud metadata endpoints (`169.254.169.254` and equivalents) beyond what the SSRF check already blocks at the application layer — defense in depth via network-level egress filtering, not just app-level checks. **Worker's actual hosting is not yet decided as of 2026-09-02** (see DEVLOG Session 26 correction — an earlier "Hetzner" hosting decision was never actually provisioned); whatever host is chosen must provide this network-level filtering capability (firewall rules, a network namespace, or a filtering egress proxy in front of every Chromium process) — this is a hard requirement on the hosting choice, not optional infra polish.

---

## 4. Rate limiting

Per-account/per-key short-window rate limiting, **independent of the monthly quota**. This is the backstop for the half-charge-on-failure billing policy (`11-billing-and-quota.md`) — without it, hammering unblockable URLs at 0.5 charge per attempt is a viable abuse vector. Implement as a Redis-backed sliding window, checked in the same `mcp-server` pipeline stage as the quota check (§3 of `04-mcp-server-and-auth.md`).

---

## 5. Input hygiene

Everything arriving at `mcp-server` is untrusted, including well-formed-looking tool args from a compliant MCP client — the LLM authored them. Zod-validate every tool call against the schema in `@ocular/shared` before any other logic runs. Never hand-parse or regex-validate what a Zod schema should be validating.

---

## 6. Output hygiene

- Extractors (`design-tokens.ts`, `assets.ts`) emit only public URLs and capped-size derived data — never raw stylesheets, never arbitrary file contents from the target page.
- A malicious page cannot balloon Ocular's response: every extractor has a hard cap on elements walked and output size (see `05-worker-and-browser-pipeline.md` §4).
- Error messages returned to the agent never include stack traces, internal file paths, SQL errors, or raw upstream error bodies — see `09-error-handling-and-logging.md` §2.

---

## 7. Secrets

Proxy credentials (Webshare, DataImpulse, Decodo), AuthKit signing keys, Bachs webhook secret, Redis/Postgres connection strings — all via environment variables or a secret manager only. Never hardcoded, never committed, never logged. Full convention in `12-environment-and-secrets.md`.

---

## 8. Cookie/authenticated-page browsing

**Cloud path: still out of scope, unchanged.** Rendering a logged-in page from Ocular's infrastructure would require credential or session custody, which this product does not do. Do not add a "just pass cookies through" shortcut to any cloud tool.

**Local path: permitted via local persistent profile** (amended 2026-09-01). `local-worker` resolves the underlying objection rather than accepting it — the user logs in once inside Ocular's own browser profile on their own machine, and the session never leaves the device. Ocular never receives, stores, transmits, or logs a credential. Full rules in `13-local-worker-and-distribution.md` §5.

**Rule:** cookie extraction and session replay from the user's primary browser are **permanently out of scope on both paths**, not deferred. Chrome's Device Bound Session Credentials cryptographically binds sessions to the authenticating device specifically to defeat this pattern (GA on Windows as of Chrome 146). Any design that _moves_ a session is on a vendor-enforced path to breaking.

---

## 9. Security checklist — every PR that touches auth, the SSRF path, or a tool handler

```
[ ] Token verification unchanged or improved, never weakened/bypassed
[ ] Both SSRF check layers (mcp-server pre-check + worker authoritative check) still fire
[ ] Redirect hops re-checked, hop count capped
[ ] New/changed tool args validated with a Zod schema from @ocular/shared
[ ] No secrets in code, logs, or error messages
[ ] Extractor output still size-capped and public-URL-only
[ ] Rate limiting still applies to the new/changed path
[ ] No new direct patchright import outside self-hosted-provider.ts
[ ] Cloud SSRF check has no new skip/bypass parameter (§2)
[ ] No credential read, stored, transmitted, or logged on either path (§8)
```

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
