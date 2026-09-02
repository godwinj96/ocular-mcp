# Ocular — Product Requirements Document

**Status:** v0.2 — Reconciled
**Supersedes:** v0.1 (written without knowledge of the existing `ocular-mcp` repo; substantially invalid)
**Relationship to repo:** This document is an **amendment layer** over the existing planning docs in `research & planning/` and `docs/rules/`. Where this document is silent, the repo's locked decisions stand unchanged. Where it explicitly amends, this document wins and the corresponding repo doc should be updated to match.

---

## 0. What Changed and Why

The existing product is a cloud-backed stealth-browser MCP server: remote Streamable HTTP transport, OAuth via AuthKit, Patchright on Hetzner, a four-rung stealth ladder, quota/billing/rate-limiting, four read-only tools. It is largely built, tested, and deployed (`useocular.dev` is live).

A research pass in a separate session — market discovery across Reddit/HN/GitHub/dev.to, plus direct verification against current browser-security and competitor developments — produced findings that **add to** rather than replace that architecture. The central finding:

> **The strongest validated demand signal is developers verifying their own in-progress UI in a coding-agent loop** — localhost dev servers, canvas/WebGL, layout correctness. This is where DIY workarounds are most numerous (screenshot MCP wrappers, cron diff monitors, manual screenshot-paste) and where vision is _provably required_ rather than merely preferred.

The shipped architecture cannot serve that segment: its SSRF guard blocks private IPs by design, and correctly so for a cloud renderer. Serving it requires a **local execution path** alongside the cloud one.

This document defines the merged product.

---

## 1. Product Shape

**One product. One local install. Two execution paths, routed by target.**

```
Agent (Claude Code / Cursor / etc.)
   │  stdio MCP
   ▼
Local MCP server  ──────► Local worker    (localhost, dev servers, authenticated pages)
   │                       chrome-headless-shell, no stealth, private IPs permitted
   │
   └─────── HTTPS ───────► Cloud API      (public web)
                            Patchright + stealth ladder, SSRF-enforced
```

A **second, remote MCP server** (the existing HTTP+OAuth surface) remains for clients that cannot run a local binary: claude.ai connectors, hosted CI, web-based agents. It serves the cloud path only.

**Why two MCP surfaces is cheap here:** there is effectively no state to synchronize. Auth is outsourced to AuthKit; quota and cache live server-side; the local worker holds only its own browser profile and local cache. The two surfaces are independent front doors onto the same backend, not a distributed system.

---

## 2. The Two Workers Have Different Threat Models

This is the key insight that dissolves most of the apparent conflict between the shipped architecture and the new local path. **The same guard rail is correct in one context and wrong in the other.**

| Concern             | Cloud worker                                                                                                                              | Local worker                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target              | Arbitrary public URLs, potentially hostile                                                                                                | User's own machine and chosen sites                                                                                                                                                                                                         |
| SSRF                | **Absolute. MVP-blocking.** An attacker reaching internal network or cloud-metadata endpoints via Ocular's infrastructure is catastrophic | **Not applicable to private IPs** — "reach localhost" is a developer viewing their own dev server; no privilege boundary is crossed. Still block cloud-metadata ranges (169.254.169.254, etc.) defensively in case the worker runs on a VPS |
| Anti-bot            | Real. Sites actively fingerprint and block                                                                                                | None. A dev server does not fingerprint its owner                                                                                                                                                                                           |
| Engine              | **Patchright** — vanilla Playwright is detectable via automation-protocol fingerprinting (locked repo decision, unchanged)                | **`chrome-headless-shell`** — lighter, no stealth overhead needed                                                                                                                                                                           |
| Stealth ladder      | Core. Retained (see §7)                                                                                                                   | Not applicable                                                                                                                                                                                                                              |
| Authenticated pages | Deferred — would require credential custody                                                                                               | **Enabled** via local persistent profile (see §5)                                                                                                                                                                                           |

**Verification required before shipping:** confirm empirically that Patchright and `chrome-headless-shell` produce near-identical renders of the same page. Both are Chromium-family so they should, but a visible difference between paths would undermine the core promise. Test before assuming.

---

## 3. Local Worker — Architecture

### 3.1 Three-tier lifecycle

The tension between "always warm" (fast) and "set and forget" (invisible) resolves by tiering:

| State      | Condition                       | Resident footprint                                  |
| ---------- | ------------------------------- | --------------------------------------------------- |
| **Idle**   | No activity >~30 min            | Supervisor only, browser fully shut down (~10-15MB) |
| **Recent** | Session active, no live capture | Browser warm, all contexts closed (~150-200MB)      |
| **Active** | Capture in flight               | Warm browser + live context                         |

The **idle number is the one that matters** — it is what a developer sees in Activity Monitor when they are not using the product. Everything else is transient.

### 3.2 Supervisor: Go

The supervisor watches an idle timer, holds an IPC socket, spawns/kills the browser child process, and restarts it on crash.

**Language decision: Go.** Rationale: native concurrency for the wait/timer/socket pattern, standard library covers process management without third-party dependencies, fast compile-iterate loop. Rust would save perhaps 5MB of baseline (no GC runtime) — immaterial at this scale — at the cost of significantly harder AI-assisted iteration and code review for a maintainer who does not write either language. Go is small and explicit enough to review without deep familiarity; Rust's lifetimes, error handling, and async story are not.

**Platform requirements for true invisibility (see §3.5):** build with `-ldflags="-H windowsgui"` on Windows so no console window appears.

### 3.3 Warm-on-handshake

**Warm the browser on the MCP `initialize` handshake, not on first capture.** An agent session starting is a strong signal a capture is likely. This converts cold-start from a per-call cost (chrome-devtools-mcp's core latency problem) into a once-per-session cost the user never perceives.

_Status: no prior art found for this specific technique, but treat as unverified rather than novel — this session's consistent pattern was that apparently-clever ideas turn out to already exist._

### 3.4 Install footprint

`chrome-headless-shell` is a ~150-200MB download. **Detect and reuse an existing local Chromium where one is present** rather than always shipping a copy. Decide before first release; retrofitting install behavior is worse than getting it right initially.

### 3.5 Invisibility requirements

The "set and forget" promise means **no visible window, no taskbar/dock entry, no unexpected prompts** during normal operation. `chrome-headless-shell` has no windowing code at all and cannot display a window — that part is structural, not configuration. The remaining risks are platform packaging details, each of which must be handled explicitly:

| Risk                                      | Platform       | Mitigation                                                                                                                                                       |
| ----------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console window flash on supervisor launch | Windows        | Build with `-ldflags="-H windowsgui"`                                                                                                                            |
| Dock icon appears                         | macOS          | If bundled as `.app`, set `LSUIElement=true` in `Info.plist`. A bare binary does not show in the Dock                                                            |
| Gatekeeper block on first run             | macOS          | Code-sign and notarize. Otherwise the user sees a security dialog at install — a one-time but severe intrusion                                                   |
| Firewall permission prompt                | macOS, Windows | Bind the IPC socket to **loopback only**. A prompt asking to accept incoming connections directly contradicts the invisibility promise                           |
| Auto-start behavior                       | All            | Decide explicitly whether the supervisor launches at login or on first MCP connection. Launching at login is more invisible in use but more intrusive to install |

**Unavoidable and accepted:** processes remain visible in Activity Monitor / Task Manager. This is why the idle footprint (§3.1) is the number that matters — a developer who goes looking will find it, and what they find should be ~10-15MB, not a running browser.

**One deliberate exception:** the authenticated-profile flow (§5) requires a **visible, headed browser window** so the user can log in. This is user-initiated, one-time per site, and should be clearly framed as such — it is the only circumstance in which Ocular shows a window.

---

## 4. Quota and Pricing

### 4.1 Amendment: the 300/month quota is superseded

The repo's flat 300/month quota predates the local/cloud split and does not survive it. Local and cloud have fundamentally different marginal costs and must be metered differently.

| Path              | Quota                               | Rationale                                                                                                                                      |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local renders** | **Unlimited**                       | The user's machine does the work. Zero marginal cost. This directly serves the validated dev-loop wedge, where high call frequency is the norm |
| **Cloud renders** | **~30-50/day** (~1,000-1,500/month) | Bounded by real render + proxy cost (see §4.2)                                                                                                 |

The local worker must still validate an active subscription against the server, or unlimited local rendering is trivially freeloadable.

### 4.2 Cloud unit economics (the constraint behind the cap)

At $2.50/mo: after payment processing (~$0.38 on a small transaction) and amortized fixed infrastructure, roughly **$1.90/user/month** is available for render cost.

- A rung-0 cloud render: ~$0.001 all-in.
- 300/day = 9,000/month ≈ **$9 of render cost against $1.90 of headroom.** Not viable.
- Escalations compound this: residential proxy is billed per GB, a page pull is several MB, so even 5-8% escalation adds $1-2/user.

Ambient pricing survives only on low _average_ utilization — but heavy users are precisely those who hit caps, and they consume the margin of everyone who does not. A daily cap of 30-50 is 3-5x more generous than the current 300/month while remaining survivable.

### 4.3 Tiering

Tier boundaries are drawn by **what each rung does to unit economics**, not by arbitrary feature gating. The base tier includes every rung it can absorb.

| Tier       | Price                                | Includes                                                                                         |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Base**   | $2.50/mo                             | Unlimited local. Cloud rungs **0 and 1** (datacenter proxy + residential proxy). Daily cloud cap |
| **Higher** | ~$13.99/mo, ~$100/yr _(provisional)_ | Adds rungs **2 and 3** (Camoufox, paid unblocker API)                                            |

**Charge multipliers are what make rung 1 safe on the base tier.** Rung 1 is residential proxy, billed per GB — roughly $0.002–0.005 per render depending on page weight. At ~10% escalation that is ~$0.30/user/month against $1.90 of headroom, comfortable. At 60–80% escalation — a user whose targets are mostly protected sites — it breaks the tier.

The fix is to charge escalated renders multiple quota units rather than gating them: a rung-1 render costs ~3 units against the daily cap, so a user who escalates constantly exhausts their cap three times faster. This bounds cost automatically without a separate escalation quota or a hard feature wall. Exact multipliers per rung are set from real cost data (see blocking dependency below).

**Blocking dependency:** neither the $13.99 figure nor the per-rung multipliers can be finalized without real cost data, which requires provisioning the vendor accounts M3 is already blocked on (Webshare, DataImpulse, Camoufox, Decodo). Both are provisional until then.

**Honesty constraint on the base tier:** rungs 0–1 clear most protected sites but not all — rung 2/3 targets (hard Cloudflare challenges, Turnstile, aggressive fingerprinting) will still fail on base. Sell base as _"your dev server plus the open web"_ — never in language implying every site is reachable. Overselling this produces exactly the failure users will be loudest about.

### 4.4 Cache pricing

Cloud cache hits: **half charge or free.** A shared cache hit costs almost nothing to serve, and "popular pages are free" is a favorable growth property. Decide, but either is defensible.

---

## 5. Authenticated Pages — Unblocked

The repo deferred logged-in browsing entirely as a security risk requiring its own threat model. **The local worker resolves the underlying objection rather than accepting it.**

Mechanism: Ocular's local browser maintains its own persistent profile. The user logs into the sites they care about **once**, inside that profile, on their own machine. The session is created on the device and stays there.

This sidesteps every objection at once:

- **No credential custody.** Ocular never receives, stores, or transmits a credential. Developer sentiment on third-party credential custody is strongly negative and this avoids it entirely.
- **DBSC-compatible by construction.** Chrome's Device Bound Session Credentials binds sessions to the authenticating device — already GA on Windows as of Chrome 146, rolling out further. Any approach that _moves_ a session (cookie extraction, session replay) is being actively killed by browser vendors. Authenticating in place is the only durable path.
- **No IP or fingerprint mismatch.** The session is used from the same machine that created it.

**Requires a headed window.** Login cannot happen headlessly. This is the one deliberate exception to §3.5's invisibility requirement — user-initiated, one-time per site, and should be framed explicitly as such in the UX.

**Scope:** phase 2 of the local worker, not day one. **Also amends the repo's deferral rationale** — the deferral was correct for a cloud-only architecture, and is now superseded rather than merely postponed.

---

## 6. New Capabilities

### 6.1 Accessibility tree extraction and annotation _(new — no equivalent in repo)_

Ship the accessibility tree alongside every screenshot, on both workers.

Pixels and the a11y tree each carry information the other loses. A screenshot cannot show content below the fold; the tree cannot represent canvas/WebGL, or visual correctness at all. Sending both closes each gap.

**Annotate each node with viewport position** (in-view vs. below-fold, plus coordinates) — Set-of-Mark style. **Annotate, never filter to the viewport**: the tree's principal advantage over the screenshot is exactly that it exposes what the screenshot cannot show. Filtering discards the reason to send it.

### 6.2 Motion and animation capture _(new — likely a fifth tool)_

**Hard constraint:** Claude accepts no video input, and animated GIFs are read first-frame-only. Motion must ship as discrete still images.

**Two modes:**

- _Verification (default):_ adaptive diff-triggered sampling, delivered as a **contact sheet** — tiled frames at one image's token cost rather than N images'.
- _Analysis (opt-in):_ fixed high-fps, full-size untiled frames. Undersampling invents artifacts that are not present — a failure mode already encountered on this project, where a 5fps analysis reported a "scale-pop" that measured 0.0% overshoot.

**Scroll-driven animation requires a different sampling axis.** Perceptual diffing fails because scrolling changes nearly every pixel regardless of what the animation is doing.

- _Scroll-scrubbed_ (parallax, pinned sections, scroll-timeline): sample by **scroll-offset increment**, not time.
- _Scroll-triggered_ (fires past a threshold, then runs on its own clock): scroll to trigger, hold still, then time-sample.
- _Known gotcha:_ Lenis, Locomotive Scroll, and similar hijack native scrolling — programmatic `scrollTop` may not drive their animation state; simulated wheel input may be required.

### 6.3 Two-tier caching _(new)_

| Cache     | Scope                          | Contents                                                           |
| --------- | ------------------------------ | ------------------------------------------------------------------ |
| **Local** | Device only, never transmitted | localhost and authenticated captures — may contain logged-in state |
| **Cloud** | Shared across all users        | Public URLs only                                                   |

**The cloud cache is populated exclusively by Ocular's own cloud renders — never by user-contributed captures.** This eliminates cache-poisoning risk entirely rather than requiring trust-scoring or verification machinery.

Required parameters:

- **Variable TTL**, keyed on target volatility (a pricing page and a docs page have very different staleness tolerances). Traffic-derived TTL is a reasonable heuristic and is not difficult to implement.
- **Explicit `fresh: true` force-refresh** on every capture tool. A cached screenshot of a competitor's pricing page is worthless if it is three days old.

The shared cloud cache is also one of only two structurally defensible advantages (see §8) — a solo DIY setup's cache hit rate is bounded by its own repeat requests.

---

## 7. Retained From Repo — Corrections to v0.1

v0.1 argued to drop the following. **Those arguments were made without knowledge of the repo and are withdrawn.**

- **Stealth ladder: retained.** v0.1's objection rested on two false premises — that execution was local-only (no cloud target needing protection) and that no quota system existed (so proxy cost would be unbounded). Both are wrong: the cloud path is real and load-bearing, and cost exposure is already bounded by quota, charge policy, and per-key rate limiting. The ladder is half-built and serves a path being kept.
- **Cloud rendering: retained.** Same error — reasoned as if cloud did not exist.
- **Patchright: retained** for the cloud path (`chrome-headless-shell` is local-only).
- **Block classifier: retained** — already built, and already caught a real bug (treating `server: cloudflare` as a challenge signal, which would have false-flagged much of the web).
- **Image pipeline: unchanged** — sharp → ≤1568px long edge → WebP ≤200KB with a `detail` knob. This independently matched what the research session derived, which is mild corroboration for both.

---

## 8. Positioning

**Local-led, cloud as amplifier.** The validated demand is dev-loop verification; the cloud stealth capability is the "and it also does this" extension. Combined, the pitch is stronger than either half: _sees your dev server and the live web._

**Requires a website rewrite** — the live site sells the cloud story exclusively.

### 8.1 Safety claim — exact wording matters

Say: **"Ocular cannot act on your browser."**
Never say: **"safe to use with sensitive data."**

Read-only removes the _action_ risk. It does not remove exfiltration or prompt-injection risk: captured content enters the calling agent's context, and an agent with other tools could relay it. Page content can also attempt to steer the agent's subsequent behavior even though Ocular itself cannot be made to click anything. Blurring this in marketing copy is the kind of claim that invites a security-researcher takedown.

### 8.2 Defensibility — verified findings, not assumptions

Technique-level differentiation was checked directly and does not exist:

- Diff-based partial capture is already a free open-source MCP server (DiffLens), plus a Pixelmatch-based equivalent.
- Cross-user shared caching is already documented standard practice among hosted screenshot APIs, some of which do not bill for cache hits.
- Every optimization considered this session — downscaling, a11y annotation, contact sheets, scroll sampling, diffing, caching — was already public best practice or already shipped free.

**Two things remain structurally defensible, and neither is invention:**

1. **Maintained completeness** — bundling all known-good techniques and keeping them working through Chrome/framework churn, indefinitely. Most DIY setups never finish or maintain past first-working-version.
2. **Multi-tenant cache economics** — a solo script's cache hit rate is bounded by its own repeats; a service with overlapping users gets real hits for free. The mechanism is public; the advantage only exists at scale.

Do not position on cleverness.

---

## 9. Open Decisions

1. **Cloud cache hits: half-charge or free?** Both defensible.
2. **Exact daily cloud cap** within the 30-50 range — needs real usage data to tune.
3. **Higher-tier price and per-rung charge multipliers** — blocked on M3 vendor accounts for real cost data.
4. **Bundle vs. reuse Chromium** on local install (§3.4) — decide before first release.
5. **Fidelity parity** between Patchright and `chrome-headless-shell` (§2) — verify empirically.
6. **Auto-start at login vs. on first MCP connection** (§3.5) — invisibility in use vs. intrusiveness at install.

---

## 10. Immediate Implications for the Repo

Ordered by dependency, not priority:

1. **Amend `research & planning/02-conclusions-and-recommendations.md`** — the locked decisions on transport (local stdio deferred), authenticated pages (deferred), and quota (300/month flat) are all superseded by this document. Record as amendments with rationale, consistent with how the repo already handles reversals.
2. **New `packages/local-worker`** — Go supervisor + `chrome-headless-shell` + local MCP stdio server + local cache. Platform packaging per §3.5 is part of this work, not a later polish step.
3. **SSRF becomes path-dependent** — the cloud check stays absolute; the local worker permits private IPs while still blocking cloud-metadata ranges. This must be an explicit, documented split, not a bypass flag, or it will be misread as a weakening of the cloud guarantee.
4. **A11y tree extractor** — new, applies to both workers.
5. **Quota model split** — local unlimited (with subscription validation), cloud daily-capped, with per-rung charge multipliers. Touches `shared/constants.ts`, `shared/charge.ts`, `redis-quota.ts`, `settle-quota.ts`, and the billing docs.
6. **Motion capture tool** — new fifth tool; needs a shared schema and both-worker support.
7. **Website rewrite** — local-led positioning.
8. **Authenticated local profile** — phase 2, after the local worker is stable.
