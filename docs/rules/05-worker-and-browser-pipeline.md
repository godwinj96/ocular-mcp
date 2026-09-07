# Ocular — Worker & Browser Pipeline Rules

**Section 5 of 13 · Always Apply**

> **Scope: the cloud `worker` only.** `packages/local-worker` runs a deliberately different pipeline (no stealth ladder, `chrome-headless-shell` instead of Patchright, private IPs permitted) — see `13-local-worker-and-distribution.md`. Sections §4 (extractors), §4a (a11y tree), §4b (motion), and §5 (image pipeline) apply to **both** paths; everything else here is cloud-specific.

---

## 0. Guiding principles

1. **One deadline, threaded everywhere.** Every stage checks the remaining budget before starting, not after.
2. **`finally` always closes the context.** A page/context that outlives its job is a memory leak that compounds across thousands of requests/day.
3. **The browser is warm; the context is not.** One Patchright instance per worker process, but a fresh incognito `BrowserContext` per request, always.
4. **Escalate on evidence, not by default.** Every rung costs money (proxy bandwidth, and Rung 3 costs real dollars per call) — the ladder only climbs when the `BlockClassifier` says the current rung failed.

---

## 1. Worker process lifecycle

```
On boot:
  1. provider.init() — launch ONE warm Patchright/Chrome instance
  2. Start BullMQ Worker, concurrency = QUEUE_CONCURRENCY (start 8)
  3. Initialize render semaphore, capacity = RENDER_CONCURRENCY (start 4)
  4. Register recycle counters (request count + wall-clock timer)

Per job (inside try/finally):
  1. acquire render semaphore                                    — blocks if at capacity
  2. authoritative SSRF check (resolve DNS, block private/meta ranges, per redirect hop)
  3. routing memory lookup -> starting rung R for this domain
  4. StealthLadder.run(url, startRung=R)                          — see 07-security.md for the ladder
  5. tool-specific extractor on the successful page
  6. image pipeline (sharp) if the tool returns an image
  7. build success or exhausted-ladder-failure envelope; wipe raw buffers immediately after encode
  finally:
    - close page & context (ALWAYS — even on deadline abort or thrown error)
    - release semaphore
    - bump request counter; recycle if >= BROWSER_RECYCLE_REQUESTS or >= BROWSER_RECYCLE_MINUTES
```

**Rule:** the render semaphore is acquired _before_ the SSRF check, not after — SSRF resolution does DNS I/O and should count against concurrency like everything else in the pipeline.

---

## 2. `BrowserProvider` — the only Patchright touchpoint

See `01-architecture.md` §3 for the interface and the rule that only `providers/self-hosted-provider.ts` imports `patchright`. Concretely:

```typescript
// packages/worker/src/providers/self-hosted-provider.ts
export class SelfHostedProvider implements BrowserProvider {
  private browser: Browser | null = null;

  async init() {
    this.browser = await patchright.chromium.launch({ headless: true });
  }

  async newContext(profile: RungProfile): Promise<BrowserContext> {
    if (!this.browser) throw new Error('provider not initialized');
    return this.browser.newContext({
      proxy: profile.proxy,
      userAgent: profile.userAgent,
      viewport: profile.viewport,
      locale: profile.locale,
      timezoneId: profile.timezoneId, // MUST agree with the proxy's geo — see rung-profiles.ts
    });
  }

  async recycle() {
    await this.browser?.close();
    await this.init();
  }
  health(): ProviderHealth {
    /* rss, uptime, requestsSincRecycle */ return {} as ProviderHealth;
  }
  async dispose() {
    await this.browser?.close();
  }
}
```

**Rule:** every field in `RungProfile` (UA, viewport, platform, locale, timezone) must be internally coherent — a US residential-proxy exit IP with a `Europe/London` timezone is a fingerprint mismatch that defeats the point of escalating. `rung-profiles.ts` owns generating coherent bundles; nothing downstream hand-assembles a profile.

---

## 3. StealthLadder & BlockClassifier

- **Ladder**: iterates rungs from the routing-memory starting point up to `maxRung`, capped at `MAX_ESCALATIONS` beyond the start. On `CLEAN`, record success in routing memory and stop. On failure, close the context and either escalate (budget allows) or fail with the exhausted-ladder envelope.
- **Humanization** (Rung 0+): small randomized mouse movement, variable scroll velocity, realistic `Accept-Language` matched to the profile's locale.
- **BlockClassifier** returns exactly one of `CLEAN | CHALLENGE | HARD_BLOCK | EMPTY`, derived from HTTP status, response headers (`cf-mitigated`, `server`), challenge DOM markers (Turnstile etc.), `<title>` patterns, and an emptiness heuristic. Never infer a verdict from a single weak signal alone (e.g., HTTP 200 does not by itself mean `CLEAN`).

**Rule:** navigation uses `waitUntil: 'domcontentloaded'` plus a bounded smart-scroll/settle timer — never `networkidle` as the primary wait condition (many sites never fire it; see `research & planning/03` §7 edge cases).

---

## 4. Extractors — the product IP, kept minimal and capped

- **`screenshot.ts`** (`view_page`): `page.screenshot()`, full-page or viewport per input, height-capped for very tall pages.
- **`design-tokens.ts`** (`inspect_ui`): injected `page.evaluate`, sampled `getComputedStyle` across visible elements → deduplicated palette/typography/spacing/radius/shadow tokens + detected breakpoints. **Never return raw stylesheets** — only the derived, capped-size token JSON.
- **`assets.ts`** (`extract_assets`): inline `<svg>` (serialized, size-capped), relative `src`/`srcset`/CSS `url()` rewritten to absolute **public http(s)** URLs only (SSRF-safe by construction — never resolve or proxy the asset bytes through Ocular).

**Rule:** every extractor bounds the DOM work it does (max elements walked, max output size per category) so a pathological SPA can't blow the `page.evaluate` timeout or the response payload.

---

## 4a. Accessibility tree — shipped alongside every screenshot

Added 2026-09-01 (`docs/Ocular_PRD_v0.2.md` §6.1). **Applies to both workers.**

**Tool scope:** `view_page` (added at launch) and `motion_capture` (added 2026-09-01, same day as §4b — a moving region is unidentifiable from stills alone without knowing what element it is; extracted once, after sampling completes, not concurrently with it, since motion capture actively scrolls the page and racing the tree read against the extractor's own wheel-scroll calls would corrupt scroll position). `inspect_ui`/`extract_assets` are excluded — neither takes a screenshot, so there is no pixel gap for the tree to close.

Pixels and the accessibility tree each carry information the other structurally cannot. A screenshot cannot show content below the fold; the tree cannot represent canvas/WebGL content or visual correctness at all. Shipping both closes each gap; shipping one leaves a hole that no amount of tuning fixes.

**Rule:** annotate every node with its viewport position — in-view vs. below-fold, plus coordinates. Set-of-Mark style.

**Rule, AMENDED 2026-09-07 — scope the default response, never silently omit.** The original rule here said "annotate, never filter to the viewport": trimming the tree to the visible region throws away its principal advantage over the screenshot, which is exposing what's off-screen. That reasoning was right and the implementation was unaffordable — measured against this project's own marketing page, a full walk serialises to ~107KB (~27k tokens), which overran a real client's response budget and got truncated at the transport layer. A tree the caller never receives annotates nothing.

The amended rule keeps the guarantee and drops the cost: in-viewport nodes ship in full (role, name, coordinates, nesting), below-fold content ships as a cheap `outline` (every heading and landmark with its position, plus a per-role count of everything else down there), and the complete below-fold detail stays available on demand via the `get_tree` tool. What's still forbidden — this is the part that carried the original rule's weight — is silently omitting below-fold content altogether. A reader must always be able to tell that something exists past the fold, what kind of thing it is, and how to go and read it. See `packages/shared/src/schemas/a11y-tree.schema.ts` for the exact shape and the full rationale.

**Rule:** the tree is size-capped like every other extractor output (§4). A pathological DOM must not blow the payload.

---

## 4b. Motion & animation capture

Added 2026-09-01 (`docs/Ocular_PRD_v0.2.md` §6.2). Planned as the fifth MCP tool. **Applies to both workers.**

**Hard constraint:** Claude accepts no video input, and animated GIFs are read first-frame-only. Motion must be delivered as discrete still images. Do not attempt to return video or animated GIF from any tool.

**Two modes:**

- **Verification (default):** adaptive, diff-triggered sampling, delivered as a tiled **contact sheet** — N frames at one image's token cost rather than N images'. Sufficient for "is the stagger/easing/overshoot roughly right."
- **Analysis (opt-in, costlier):** fixed high-fps sampling, full-size untiled frames. For measuring timing curves.

**Rule: do not undersample.** Low frame rates invent artifacts that are not present in the source. This is not hypothetical — a 5fps analysis on this project once reported a "scale-pop" on entrance animations that measured 0.0% overshoot when resampled properly. Sampling rate is a correctness property, not a cost knob.

**Rule: scroll-driven animation requires a different sampling axis.** Perceptual diffing fails here because scrolling changes nearly every pixel regardless of whether the animation is doing anything interesting.

- _Scroll-scrubbed_ (parallax, pinned/sticky sections, scroll-timeline-driven): sample by **scroll-offset increment**, not by time. Progress is a deterministic function of scroll position, so stepping the offset gives frames that are meaningfully different by construction.
- _Scroll-triggered_ (fires once past a threshold, then runs on its own clock): scroll to the trigger point, **hold still**, then apply time-based sampling. Once scrolling stops, ordinary diffing works correctly again.

**Known gotcha:** JS smooth-scroll libraries (Lenis, Locomotive Scroll, and similar) hijack native scrolling and drive it from their own animation loop. Setting `scrollTop` programmatically may not update their internal state at all — simulated wheel input may be required. Detect and handle rather than silently capturing a frozen animation.

---

## 5. Image pipeline (`sharp`)

```
screenshot buffer
  -> if long edge > IMG_MAX_EDGE_PX (per `detail`): resize down (Lanczos)
  -> encode WebP, starting quality IMG_WEBP_QUALITY
  -> step quality/dimensions down until <= IMG_MAX_KB or a floor is hit
  -> return { b64, mime: 'image/webp', w, h, bytes }
  -> free the raw buffer immediately (do not retain across the request)
```

`detail` (`low`/`balanced`/`high`) maps to a max-edge ceiling — defined once in `shared/src/constants.ts`, not re-derived per call site.

**Why the ceiling exists:** vision models resize internally to a fixed processing resolution before tokenizing (~1568px long edge for Claude). Pixels beyond that cap cost tokens and bandwidth for exactly zero accuracy gain. Never upscale a below-cap image either — it adds tokens and no information.

---

## 5a. Caching

Added 2026-09-01 (`docs/Ocular_PRD_v0.2.md` §6.3). Two caches exist and they are **not** interchangeable.

| Cache     | Scope                                | Contents                                                         |
| --------- | ------------------------------------ | ---------------------------------------------------------------- |
| **Cloud** | Shared across all users              | Public URLs only                                                 |
| **Local** | The user's device, never transmitted | localhost + authenticated captures — may contain logged-in state |

**Rule:** the cloud cache is populated **exclusively by Ocular's own cloud renders** — never by user-contributed or locally-rendered captures. This makes cache poisoning structurally impossible rather than requiring trust-scoring machinery to mitigate it.

**Rule:** every capture tool exposes an explicit `fresh: true` force-refresh parameter, and cache TTL varies by target volatility (a pricing page and a docs page have very different staleness tolerances). Both caches honour the same contract so agents see consistent behaviour regardless of which path served them.

**Rule:** the cloud cache never stores a render for a URL carrying a query string, userinfo (`user:pass@host`), or a secret-shaped path segment (`token`, `reset`, `invite`, `share`, `auth`, `session`, `otp`, `code`, …) — see `packages/shared/src/cache-key.ts`'s `isCacheableUrl`, enforced by the writer in `packages/worker/src/cache/cloud-cache.ts` before every `SET`. A URL shaped like that is plausibly personalized or single-use; caching it risks leaking one user's content to any other caller who requests an identical-looking URL. This is a blanket exclusion — a cache miss just costs one extra render, never a leak. (Geo/locale-keyed caching, so the same URL can cache differently per requester region, is not yet implemented — tracked as a follow-up, not blocking.)

---

## 6. Edge cases the pipeline must handle (see `research & planning/03` §7 for full list)

- Infinite-scroll: cap scroll iterations and total scroll time; note truncation in `meta`.
- Redirect chains/shorteners: follow with per-hop SSRF re-check, cap hop count.
- Non-HTML responses (PDF, direct image, download): detect content-type, return `RENDER_ERROR` — never screenshot a download dialog.
- Cookie/consent interstitials: best-effort, time-boxed auto-dismiss; never blocks success if dismissal fails.
- Worker crash mid-job: BullMQ job becomes failed/stalled → `mcp-server` returns `TIMEOUT`/`RENDER_ERROR`; nothing is charged if no envelope was produced.
- Browser recycle during active jobs: drain, route new contexts to the standby browser — never kill an in-flight job to recycle.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
