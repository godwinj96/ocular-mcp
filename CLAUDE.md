# Ocular

Read-only visual perception for AI agents via MCP. **One product, two execution paths:** a local worker (localhost, dev servers, authenticated pages) and a cloud worker (public web, stealth-capable).

**Before doing anything else in this repo, read `DEVLOG.md` at the repo root.** It has the status board, every locked architecture decision, and the session log. Update it before ending any session that changes plans or ships code.

**Product spec: `docs/Ocular_PRD_v0.2.md`** — an amendment layer over `research & planning/`. Where v0.2 is silent, the repo's locked decisions stand. Where it explicitly amends, v0.2 wins and the underlying planning doc should be updated to match.

Full research and architecture plan: `research & planning/00-INDEX.md` (read in numeric order: `01` research → `02` conclusions/decisions → `03` build plan → `04` open questions → `05` user flows).

**Before writing any code, read `docs/rules/`.** It's the enforceable ruleset (one file per area — architecture, repo structure, shared contracts, MCP/auth, worker pipeline, external fetching, security, performance, error handling, testing, billing, environment/secrets) distilled from the planning docs above, meant to prevent drift as the codebase grows. `.cursor/rules/*.mdc` mirrors these for Cursor but is not the source of truth — `docs/rules/*.md` is canonical; edit there.

---

## The core distinction: two workers, two threat models

Most apparent contradictions between the older cloud-only planning docs and current direction dissolve here. **The same guard rail is correct in one path and wrong in the other.**

|                | Cloud worker                                           | Local worker                                                 |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Target         | Arbitrary public URLs, potentially hostile             | User's own machine and chosen sites                          |
| SSRF           | **Absolute, MVP-blocking**                             | Private IPs **permitted**; still block cloud-metadata ranges |
| Engine         | **Patchright** (vanilla Playwright is fingerprintable) | **`chrome-headless-shell`**                                  |
| Stealth ladder | Core, retained                                         | N/A — a dev server doesn't fingerprint its owner             |
| Auth'd pages   | Not supported (would require custody)                  | **Supported** via local persistent profile (phase 2)         |
| Quota          | Daily-capped (~30-50/day), per-rung charge multipliers | **Unlimited** (zero marginal cost)                           |

The SSRF split must be **explicit and documented**, never a bypass flag — it will otherwise be misread as weakening the cloud guarantee.

---

## Hard constraints

- **Read-only. No exceptions.** No clicking, typing, form-filling, navigation side effects. The boundary is the product.
- **Never a credential custodian.** No password vault, no OAuth-as-client holding third-party tokens, no extracting cookies from the user's primary browser.
- **Authenticated sessions never leave the user's machine** — one login inside Ocular's own local browser profile.
- **Local worker must validate an active subscription** or unlimited local rendering is freeloadable.

---

## Local worker

- **Three-tier lifecycle.** Idle >~30min → browser fully shut down, supervisor only (~10-15MB). Recent → warm browser, contexts closed (~150-200MB). Active → warm + live context. **The idle number is the one that matters** — it's what a developer sees in Activity Monitor when not using the product.
- **Supervisor in Go**, not Rust. Native concurrency for the wait/timer/socket pattern, stdlib covers process management, reviewable without deep familiarity. Rust's ~5MB baseline saving is immaterial here and its lifetimes/async make AI-assisted iteration and review much harder.
- **Warm the browser on MCP `initialize`**, not first capture — converts cold start from per-call cost (chrome-devtools-mcp's core problem) to once-per-session, invisible to the user.
- **Detect and reuse existing local Chromium** where present rather than always shipping a ~150-200MB copy. Decide before first release.

### Invisibility is a hard requirement, not polish

`chrome-headless-shell` has no windowing code and cannot show a window — that part is structural. The rest is packaging, and each item must be handled explicitly:

- **Windows:** build the supervisor with `-ldflags="-H windowsgui"` or a console window flashes on launch.
- **macOS:** if bundled as `.app`, set `LSUIElement=true` in `Info.plist` to stay out of the Dock. Code-sign and notarize, or Gatekeeper shows a security dialog at install.
- **All platforms:** bind the IPC socket to **loopback only**. A firewall prompt asking to accept incoming connections directly contradicts the promise.
- **Accepted:** processes are visible in Activity Monitor / Task Manager. That's why the idle footprint matters.
- **One deliberate exception:** the authenticated-profile login flow needs a real headed window. User-initiated, one-time per site, framed as such.

---

## Capture pipeline

- Downscale to the model's native cap (~1568px long edge for Claude) before sending. More pixels past that = more tokens, zero accuracy gain.
- WebP ≤200KB with a `detail` knob (existing pipeline, unchanged).
- Never upscale a below-cap image. Crop to region of interest when only part of the UI matters.
- **Always ship the accessibility tree alongside the screenshot**, annotated with in-viewport vs. below-fold position and coordinates. **Annotate, never filter** — the tree's whole advantage is exposing what the screenshot can't show.

## Motion capture

- Claude accepts **no video**; animated GIFs read **first-frame-only**. Motion ships as discrete stills.
- Default: **contact sheet** (tiled frames, one image's token cost). Opt-in analysis mode: high-fps full-size frames.
- Undersampling invents artifacts — a 5fps analysis on this project once reported a "scale-pop" that measured 0.0% overshoot.
- **Scroll-driven animation needs a different sampling axis** — diffing fails since scrolling changes every pixel. Scroll-scrubbed → sample by scroll offset. Scroll-triggered → scroll to trigger, hold, then time-sample.
- Lenis / Locomotive Scroll hijack native scroll; programmatic `scrollTop` may not drive their state — simulated wheel input may be needed.

## Caching

- **Two caches.** Local (device-only, localhost + authenticated captures — may contain logged-in state, never transmitted). Cloud (shared, public URLs only).
- **Cloud cache is populated only by Ocular's own renders**, never user-contributed — eliminates poisoning risk without trust-scoring machinery.
- Variable TTL keyed on target volatility + explicit `fresh: true` force-refresh on every capture tool.

---

## Explicitly rejected — don't propose these

- **Cookie extraction / session replay** from the user's browser. Chrome's Device Bound Session Credentials binds sessions to the authenticating device specifically to kill this — GA on Windows as of Chrome 146. Dying approach.
- **Custom browser engine.** Ladybird (full-time funded team, from scratch) targets _alpha_ 2026, stable 2028. Not a startup-scale problem. Servo is watch-list, not adopt.
- **Remote tunnel** to reach the user's localhost from cloud. Reintroduces the latency and privacy problems the local worker exists to solve.
- **Dropping the stealth ladder or cloud rendering.** An earlier draft argued for this on the false premise that no cloud path or quota system existed. Both are real; the argument is withdrawn.
- **Technique-based moat claims.** Diff-based partial capture and cross-user caching are already shipped free elsewhere (DiffLens, hosted screenshot APIs). Every optimization considered — downscaling, a11y annotation, contact sheets, scroll sampling, diffing, caching — is already public practice. Don't position on cleverness.

---

## Positioning guardrails

- **Local-led, cloud as amplifier:** "sees your dev server _and_ the live web."
- Say **"Ocular cannot act on your browser."** Never **"safe to use with sensitive data"** — read-only removes _action_ risk, not exfiltration or prompt-injection risk. Captured content still enters the calling agent's context.
- **Base tier honesty:** rungs 0–1 clear most protected sites but not all. Sell base as "your dev server plus the open web" — never imply every site is reachable.
- Ambient pricing ($2.50/mo base). Never position as premium or best-in-class — needing to would signal the invisibility promise has already failed.
- **Defensibility is maintained completeness + multi-tenant cache economics**, not invention. Modest, but real.

---

## Primary user

A developer using an AI coding agent who needs it to visually verify in-progress UI — usually **localhost**, often canvas/WebGL or layout correctness, where DOM/a11y parsing structurally cannot see the problem. Optimize for this loop first. Public-web scraping, monitoring, and QA teams are secondary; don't let their requirements bleed into the local path's design.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ocular-mcp** (2858 symbols, 5381 relationships, 153 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource                                    | Use for                                  |
| ------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/ocular-mcp/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/ocular-mcp/clusters`       | All functional areas                     |
| `gitnexus://repo/ocular-mcp/processes`      | All execution flows                      |
| `gitnexus://repo/ocular-mcp/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
