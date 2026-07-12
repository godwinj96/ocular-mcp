# Ocular — External Fetching & Egress Rules

**Section 6 of 12 · Always Apply**

> Ocular's entire product is fetching untrusted third-party web content on behalf of an agent. This is the "data fetching" rule file, but the data source is the open internet, not a first-party API — treat every outbound request as adversarial.

---

## 0. Guiding principles

1. **All outbound page loads go through the stealth ladder — nothing navigates ad hoc.** No component ever calls `page.goto()` outside `StealthLadder.run()`.
2. **A monotonic deadline governs every fetch.** No unbounded waits, no default framework timeouts left at their defaults.
3. **DC-first, escalate on evidence.** Never start a request at a higher (costlier) rung than routing memory + policy justify.
4. **Egress from `worker` is the only place Ocular talks to the open internet.** `mcp-server` never fetches page content directly — its SSRF pre-check resolves DNS to _validate_, not to fetch.

---

## 1. The stealth ladder is the fetch abstraction

There is no raw `fetch()`/`axios` call to an arbitrary user-supplied URL anywhere in `worker`'s render path — everything goes through `StealthLadder.run(url, startRung)`, which owns proxy selection, fingerprint coherence, and the SSRF-safe navigation. See `05-worker-and-browser-pipeline.md` §3.

The one exception: `UnblockerClient` (Rung 3) makes an HTTP call to the commercial unblocker's API, not to the target URL's origin directly — that call is proxy-provider-scoped and still passes the target URL only after the same SSRF checks.

---

## 2. Timeouts per stage

```
Stage                          Budget source                Notes
------------------------------  ---------------------------  -----------------------------------------
DNS resolution (SSRF check)     Part of JOB_DEADLINE_MS        Counts against the same deadline as render
page.goto (domcontentloaded)    Remaining deadline at rung start  Never networkidle as primary wait
smart-scroll/settle             Bounded sub-timer within goto's remaining budget
page.evaluate (extractors)      Hard cap independent of deadline — a pathological DOM must not
                                 hang past a fixed ceiling even if the deadline has budget left
Rung-3 UnblockerClient call     Own HTTP timeout, still bounded by remaining JOB_DEADLINE_MS
```

**Rule:** never start a stage (including escalating to the next rung) if the remaining budget is smaller than that stage's minimum viable time. Fail with `TIMEOUT` or `BUDGET_EXHAUSTED` instead of starting a doomed attempt.

---

## 3. Proxy usage

- **Rung 0 — Webshare (datacenter proxy):** default starting point unless routing memory says otherwise.
- **Rung 1 — DataImpulse (residential proxy):** only after a `CHALLENGE`/`HARD_BLOCK`/`EMPTY` verdict at Rung 0.
- **Rung 2 — Camoufox (optional secondary engine):** interface-ready, not required for every domain; used when Patchright specifically is the detected signal.
- **Rung 3 — Decodo Web Unlocker (paid fallback):** only after browser rungs are exhausted, gated by the per-request 1-call ceiling and the `DAILY_PAID_BUDGET_USD` circuit breaker (see `08-performance.md` §2).

**Rule:** proxy credentials are per-rung, injected via the `RungProfile`, never hardcoded in `StealthLadder` or any extractor. See `12-environment-and-secrets.md`.

**Rule:** routing memory (Redis, per-domain) always determines the _starting_ rung, never skips the SSRF check or the block classifier — routing memory is an optimization for cost/latency, not a trust shortcut.

---

## 4. Redirects

- Follow redirects, but **re-run the authoritative SSRF check on every hop** — DNS can rebind between the initial check and a redirect target, and a redirect can point at a private/metadata address even when the origin URL was clean.
- Cap total redirect hops (a small fixed constant in `shared/src/constants.ts`). Exceeding the cap → `RENDER_ERROR`, not an infinite follow.
- Normalize Unicode/IDN and punycode URLs _before_ the first SSRF check, not after — a normalization bug here is a bypass.

---

## 5. Non-HTML responses

Detect `Content-Type` before treating a response as a page to screenshot. PDFs, direct images, JSON APIs, and file downloads are not "blocked" — they're `RENDER_ERROR` with a clear reason, returned promptly rather than after a wasted full-page render attempt.

---

## 6. What never happens

- No raw `fetch()`/`axios` to a user-supplied URL anywhere in `mcp-server` (it only resolves DNS for the pre-check, never fetches the body).
- No proxying of arbitrary asset bytes through Ocular's own egress in `extract_assets` — only rewritten _public_ URLs are returned; the agent's own client fetches the bytes if it wants them.
- No `networkidle`-only wait strategy as the sole completion signal (see `05-worker-and-browser-pipeline.md` §3).
- No skipping the authoritative worker-side SSRF check because `mcp-server` already did a pre-check — the pre-check is fast/optimistic, the worker check is the one that's trusted.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
