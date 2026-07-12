# Ocular — Worker & Browser Pipeline Rules

**Section 5 of 12 · Always Apply**

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
