# 01 — Research Findings (Ocular Phase 1)

_Compiled 2026-07-10. All external claims are cited inline; source URLs collected at the bottom._

This document captures the state of the art for every fast-moving dependency Phase 1 relies on. It is descriptive (what's true), not prescriptive — conclusions and recommendations live in `02`.

---

## 1. Anti-bot / stealth browsing (the hardest and most volatile area)

### 1.1 The detection landscape has moved below the JavaScript layer

The most important shift since the brief was written: modern anti-bot systems (Cloudflare Bot Management v9, DataDome, Akamai) key on signals that exist **before a single line of page JavaScript runs**, and increasingly on **how the browser is being driven**:

- **TLS fingerprinting (JA3/JA4)** — the shape of the TLS ClientHello. A headless Chromium on Linux advertises a handshake that differs from a real Chrome-on-Windows user.
- **HTTP/2 SETTINGS frame ordering** — the order and values of HTTP/2 frames are browser/version specific and hard to spoof from a driver.
- **Automation-protocol fingerprinting** — the decisive 2026 finding. Detectors can observe artifacts of the CDP (Chrome DevTools Protocol) handshake and `Runtime.enable` leaks that reveal a page is being remote-controlled, independent of the JS-layer fingerprint. [ianlpaterson.com]

Consequence: `navigator.webdriver = undefined` and canvas/WebGL spoofing — the classic `puppeteer-extra-plugin-stealth` playbook the brief references — are **necessary but no longer sufficient**. [scrapewise.ai, humanbrowser.cloud]

### 1.2 Concrete 2026 benchmark (7 tools, 31 Cloudflare targets, 651 verdicts)

| Tool | OK | Blocked | Engine | Notes |
|------|----|---------|--------|-------|
| **nodriver** | 28 | 0 | Chrome 148 (system) | Drives Chrome over CDP directly, no Playwright shim. Only zero-block option. **Python. AGPL-3.0.** |
| **Patchright** | 25 | 3 | Chrome 148 (`channel=chrome`) | Drop-in Playwright replacement; patches CDP leaks. **Node + Python.** |
| CloakBrowser | 26 | 2 | Chromium 145 | Patched fork. |
| **Camoufox** | 25 | 3 | Firefox 135 | C++-level Firefox fork; strong fingerprint control, wins some targets Chromium forks fail, but fails others (dev.to). |
| curl_cffi | 26 | 2 | HTTP-only | A 21-line HTTP wrapper matched a 130MB patched Chromium fork — for sites that don't require JS. |
| Vanilla Playwright | 24 | 5 | Chromium 147 | Bottom tier. |
| rebrowser-playwright | 24 | 5 | Chromium 136 | **Scored identically to vanilla** despite CDP-patch claims; last commit ~Sept 2024, likely abandoned. |

Source: [ianlpaterson.com], corroborated by [scrapewise.ai], [dev.to/ianlpaterson].

**Author's stated takeaways:**
- For Cloudflare gatekeeping, `nodriver` is the only zero-block option, *because* it removes the automation-protocol handshake shape — but it's Python and AGPL-3.0.
- For a **drop-in Playwright replacement**, **Patchright with `channel=chrome`** is the recommendation. It uses the real installed Chrome, not bundled Chromium.
- Residential proxies "only mask IP source; they cannot hide TLS handshakes, HTTP/2 frame ordering, or canvas fingerprints originating from the actual host." A Linux server behind a residential proxy still advertises Linux-shape browser signals.

### 1.3 Implication for Ocular's committed stack

The brief commits to **TypeScript + Playwright**. Of the tools above:
- `nodriver` would force a Python worker and an AGPL license — a hard conflict with the Node/TS stack and a commercial product.
- `rebrowser-playwright` is effectively vanilla and appears abandoned.
- **Patchright** is API-compatible with Playwright, available for Node, and is the top Playwright-family performer.
- `Camoufox` (Firefox) is a strong secondary engine for Chromium-fork-resistant targets.

The residual gap (the ~3/31 Patchright misses, plus the sites only `nodriver` passes) is exactly what the **commercial-unblocker fallback tier** exists to cover.

---

## 2. Model Context Protocol (MCP) — SDK and transport

- The **official `@modelcontextprotocol/sdk`** (TypeScript) implements the full spec: tools, resources, prompts, and both **stdio** and **Streamable HTTP** transports. `McpServer` + `StdioServerTransport` is the minimal server shape. [github.com/modelcontextprotocol/typescript-sdk, ts.sdk.modelcontextprotocol.io]
- **Zod** is a required peer dependency for tool input schema validation. [npmjs.com]
- Tools can return **multimodal content** — a content array mixing `text` and `image` blocks (base64 + mime type). This is exactly the mechanism Ocular needs to return a WebP screenshot alongside a JSON design-token text block in one response. [techwithibrahim.medium.com]
- The 2026 draft revision (`2026-07-28`) supports connection-pinned stdio serving for long-lived connections. Newer clients negotiate protocol version at connect time; a server should pin behavior to the era the client opened with.
- **Security posture from the SDK docs:** "treat all tool inputs as untrusted — they come from an LLM, not directly from the user." This matters for SSRF (see §7): the agent can pass any URL string. [webfuse.com MCP cheat sheet]

---

## 3. Headless Chromium at scale — memory and pooling

Consistent, strongly corroborated findings across multiple production write-ups [rendershot.io, medium/@onurmaciit, webscraping.ai, medium/@devcriston]:

1. **Chromium leaks memory as an operating reality**, not a fixable bug — it's a 30M-line C++ program. Plan for it; don't try to defeat it.
2. **One browser process per worker, launched once at startup and reused** — not one browser per request. Launch cost is high; reuse eliminates it.
3. **Fresh `BrowserContext` per request/tenant, always.** A `BrowserContext` is Playwright's isolation unit (own cookies, storage, cache). Sharing a context across tenants **leaks session cookies from tenant A into tenant B's render** — a correctness *and* security bug. Create context → use → close, every request.
4. **Hard concurrency cap via semaphore.** A persistent browser will happily open 50 tabs and eat 8GB. For an 8GB node, keep **~3–4 concurrent active pages** per browser. (This directly contradicts the brief's "15 concurrent jobs per worker" — see `02` §4.)
5. **Scheduled process recycling.** Gracefully terminate and relaunch the browser after a bounded number of requests (the brief says 250–500; a time-based ceiling should also apply). This resets the leaked memory pool.
6. **Docker `/dev/shm` gotcha.** Default `/dev/shm` is 64MB; Chromium's render pipeline uses it heavily and **crashes when it fills**, often leaving a zombie process while the Node parent stays alive. Fix: mount a larger `/dev/shm` (or `--disable-dev-shm-usage`, with tradeoffs) and add zombie reaping (`dumb-init`/`tini`).

The recurring one-line summary from practitioners: *"one browser per worker, semaphore-capped concurrency, scheduled restarts, and fresh contexts; skip any one and the worker eventually crashes."*

---

## 4. Image payloads & LLM vision token economics

This is where Ocular's "token payload optimization" objective is won or lost. The developer pays the vision-token bill, so smaller/cheaper images are a *product feature*, not just a server saving.

- **Every provider tokenizes images differently**, and the spread is enormous: the same JPEG can cost ~87 tokens on one model and 6,000+ on another. [blog.roboflow.com]
  - **Claude (Opus 4.x):** area-based — roughly `width × height / 750` tokens; **caps the long edge at 1568px**.
  - **GPT-5.x:** patch-based, 32×32px tiles; caps at **2048px**; low-detail vs high-detail can be a **13×** cost difference for the same answer.
  - **Gemini 3.x:** tile grid with a **258-token minimum** floor for small images.
- **Token cost scales roughly quadratically with resolution** (patch count ∝ area). Halving each dimension quarters the token cost.
- **Downscale *before* sending to the provider's cap.** "The provider would have downscaled anyway" — sending a 4K screenshot to Claude just pays to transmit pixels that get discarded. [spoold.com, image-optimizer.app]
- **WebP** is broadly supported by vision pipelines and gives materially smaller payloads than PNG at equivalent perceptual quality; it's the right on-the-wire format. (The brief's WebP choice is validated.)

**Design consequence:** Ocular should render at a controlled viewport, cap the long edge to a configurable ceiling (default ≈1568px to satisfy the strictest common cap), encode WebP at a tuned quality, and keep each payload inside the brief's **100–200KB** budget. Offer a `detail`/`quality` knob so agents can trade fidelity for tokens.

---

## 5. Proxy economics & strategy

- **Per-GB list prices (2026):** datacenter ~$0.30–$1/GB; residential ~$1–$8/GB (DataImpulse ~$1/GB PAYG at the low end, Decodo ~$4/GB, others higher); ISP/static residential ~$2–$6 per IP with bandwidth included. [aimultiple.com, dataimpulse.com, titannet.io]
- **Headline per-GB price is misleading.** The metric that matters is **effective cost = (bandwidth ÷ success rate) × price**. Datacenter at $1/GB with a 35% success rate on a protected site is *more* expensive per successful page than residential at $8/GB with 95% success. [technology.org, scrapebadger.com]
- **The industry-standard pattern is exactly the brief's two-tier plan:** cheap datacenter for easy/unprotected pages, residential only for the hard ones. "Cheap datacenter for the easy pages, residential for the hard ones, not one type for everything." [technology.org]
- **Budget buffer:** add **15–20%** on top of estimated bandwidth for retries, redirects, and challenge pages that still burn bandwidth.
- **Hidden ops cost:** proxy pool maintenance reportedly eats 10–20% of an engineer's time ongoing — an argument for a managed residential provider over self-assembled pools in Phase 1.

**Validation:** the brief's "datacenter by default, escalate to residential on 403/challenge" engine is the correct 2026 strategy. The refinement (see `02`) is to make escalation *evidence-driven* (per-domain success memory) rather than blind retry, and to cap escalations per request.

---

## 6. Commercial-unblocker fallback tier (the paid escape hatch)

Pricing models for the hard-site fallback the founder approved:

- **Bright Data Web Unlocker:** flat **~$1.50 / 1,000 requests** (per-request, no rendering multipliers). Predictable. [brightdata.com]
- **Decodo:** tiered from ~$0.50/1K down to ~$0.14/1K at higher commit. [decodo.com]
- **Zyte:** ~$1.01/1K on easy targets up to ~$16/1K for Tier-5 browser-rendered protected sites. [brightdata blog]
- **Oxylabs Web Unblocker:** per-GB (~$9.40/GB). [oxylabs.io]
- **ScrapingBee / ZenRows:** credit-based; JS rendering + premium proxy can multiply per-request cost **5×–75×**. [scrapingbee.com, iproyal.com]

**Key economic reality for Ocular:** a single fallback call at ~$1.50/1K = **$0.0015/request** is already ~75% of the entire **$0.002/run** cost target — and that's before Ocular's own compute. The fallback must therefore be **rare** (single-digit % of traffic) and **capped per user**, or it destroys unit economics. Per-request flat pricing (Bright Data style) is strongly preferable to credit multipliers for predictable cost accounting.

---

## 7. Security surface (MCP + server-side browser = SSRF magnet)

- MCP tool inputs are **LLM-generated and untrusted**. The agent can pass `http://169.254.169.254/…` (cloud metadata), `http://localhost:6379` (the worker's own Redis), `file://`, or internal RFC-1918 addresses. A naive "fetch whatever URL you're given" server is a textbook **SSRF** pipe straight into the internal network. [webfuse.com]
- The brief's "absolute link rewriting" feature (rewriting `/img/x.png` → `https://site.com/img/x.png`) must itself be SSRF-safe and must not rewrite to internal hosts.
- The open cookie/auth question in the brief (streaming a user's session cookies into an ephemeral worker) is a **high-severity data-handling feature** and should be deferred out of the Phase-1 MVP; if built, it needs memory-only handling, per-request isolation, and a documented threat model.

---

## 8. Lazy-loading, network-idle, and render completeness

- Playwright/Patchright expose `waitUntil: 'networkidle'` / `page.waitForLoadState`, but `networkidle` is discouraged as *sole* signal on modern SPAs with long-poll/analytics beacons that never idle — it can hang to timeout.
- The reliable pattern for lazy content is **programmatic smooth auto-scroll to bottom** (triggers `IntersectionObserver`-based lazy loaders and lazy `<img loading="lazy">`), then a bounded settle wait, then capture — exactly the brief's "smart scroll" protocol. It must be **time-boxed** inside the 10s budget.
- **Animation/hover-state capture** (a brief in-scope feature) is done by scripting `:hover`/`:active` via `page.hover()` / dispatched events and diffing `getComputedStyle` before/after — feasible but expensive; treat as a premium/optional path, not the default `view_page`.

---

## 9. Design-token / computed-style extraction

- The core primitive is `getComputedStyle(el)` executed **in-page** (via `page.evaluate`), which returns fully-resolved values after cascade. CSS custom properties are read by iterating the computed style and filtering names starting with `--`, then `getPropertyValue('--x')`. [MDN, xjavascript.com, handoff.design]
- Prior-art tools (DesignMD, Design Token Extractor) already do exactly what Ocular's `inspect_ui` needs: read the live DOM + CSSOM for CSS variables, computed styles, responsive breakpoints, hover/focus states, and contrast pairs, and emit a compact token blueprint. This confirms feasibility and gives a reference feature set. [designmd.cc, chromewebstore]
- **Token-saturation lesson (matches the brief's reverted decision):** do **not** dump raw stylesheets. Extract a *curated* blueprint — `:root` custom properties, a sampled/aggregated typography scale, a deduplicated color palette (from computed `color`/`background-color`/`border-color` across visible elements), and spacing rhythm — as compact JSON. The injected extractor script is the product's real IP, not the screenshot.

---

## Sources

**Stealth / anti-bot**
- https://ianlpaterson.com/blog/anti-detect-browser-benchmark-patchright-nodriver-curl-cffi/
- https://scrapewise.ai/blogs/playwright-stealth-2026
- https://dev.to/ianlpaterson/anti-detect-browser-benchmark-2026-7-stealth-tools-31-cloudflare-targets-651-verdicts-4361
- https://humanbrowser.cloud/blog/bypass-cloudflare-playwright-2026
- https://www.browserstack.com/guide/playwright-cloudflare

**MCP SDK**
- https://github.com/modelcontextprotocol/typescript-sdk
- https://ts.sdk.modelcontextprotocol.io/
- https://www.npmjs.com/package/@modelcontextprotocol/sdk
- https://www.webfuse.com/mcp-cheat-sheet
- https://techwithibrahim.medium.com/the-mcp-typescript-sdk-a-complete-guide-to-tools-resources-prompts-and-beyond-285c6ad05a07

**Chromium memory / pooling**
- https://rendershot.io/blog/headless-chromium-fleet-memory
- https://medium.com/@onurmaciit/8gb-was-a-lie-playwright-in-production-c2bdbe4429d6
- https://webscraping.ai/faq/playwright/what-are-the-memory-management-best-practices-when-running-long-playwright-sessions
- https://medium.com/@devcriston/building-a-robust-browser-pool-for-web-automation-with-playwright-2c750eb0a8e7

**Image / vision tokens**
- https://blog.roboflow.com/image-token-cost-vlm/
- https://dev.to/pritom14/i-cut-vision-llm-costs-by-989-heres-how-token0-works-under-the-hood-4ldc
- https://www.spoold.com/tools/vision-tokens
- https://www.image-optimizer.app/

**Proxies**
- https://aimultiple.com/proxy-pricing
- https://dataimpulse.com/blog/cheapest-proxies/
- https://www.titannet.io/learn/resources/top-proxies-for-web-scraping-2026-residential-vs-datacenter-vs-isp-comparison
- https://www.technology.org/2026/05/11/datacenter-vs-residential-proxies-for-web-scraping-which-should-you-choose/
- https://scrapebadger.com/blog/best-proxies-for-web-scraping-in-2026-residential-vs-datacenter-vs-mobile

**Commercial unblockers**
- https://brightdata.com/pricing/web-unlocker
- https://decodo.com/blog/webmaster-unblockers
- https://oxylabs.io/products/web-unblocker/pricing
- https://www.scrapingbee.com/blog/best-web-unblockers/
- https://iproyal.com/blog/best-web-unblockers/

**Design-token extraction**
- https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle
- https://www.xjavascript.com/blog/list-css-custom-properties-css-variables/
- https://handoff.design/js-for-css-devs/reading-css-variables.html
- https://designmd.cc/
