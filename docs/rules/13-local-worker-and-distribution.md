# Ocular — Local Worker & Distribution Rules

**Section 13 of 13 · Always Apply**

> Added 2026-09-01. Governs `packages/local-worker` — the local execution path introduced in `docs/Ocular_PRD_v0.2.md`. Nothing here applies to the cloud `worker`; see `05-worker-and-browser-pipeline.md` for that. Where the two paths diverge, the divergence is deliberate and documented in §1.

---

## 0. Guiding principles

1. **Invisibility is a product requirement, not polish.** The promise is "set it up once and never think about it again." Every visible window, dock icon, console flash, permission dialog, or unexplained process breaks that promise. Treat an invisibility regression with the same severity as a functional bug.
2. **The idle footprint is the number that matters.** A developer who opens Activity Monitor at an arbitrary moment should find a ~10-15MB supervisor, not a running browser. Transient peaks during capture are fine; a permanently resident browser is not.
3. **The local path is trusted; the cloud path is not.** This is the single biggest divergence between the two workers and the source of most apparent contradictions in this ruleset. See §1.
4. **Never move a session.** Authenticated state is created on the user's device, inside Ocular's own profile, and never leaves it.

---

## 1. Why the local worker's rules differ from the cloud worker's

The two workers have **different threat models**, so the same guard rail is correct in one and wrong in the other. This is not an inconsistency to be reconciled — it is the design.

| Concern                   | Cloud `worker`                                                                                                                | `local-worker`                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Target                    | Arbitrary public URLs, attacker-influenced                                                                                    | The user's own machine and chosen sites                                                                         |
| SSRF on private IPs       | **Blocked absolutely** — an attacker reaching internal networks or cloud metadata via Ocular's infrastructure is catastrophic | **Permitted** — "reach localhost" is a developer viewing their own dev server; no privilege boundary is crossed |
| Cloud-metadata ranges     | Blocked                                                                                                                       | **Still blocked** — the worker may run on a VPS                                                                 |
| Anti-bot / fingerprinting | Real threat                                                                                                                   | None — a dev server does not fingerprint its owner                                                              |
| Engine                    | Patchright                                                                                                                    | `chrome-headless-shell`                                                                                         |
| Stealth ladder            | Core                                                                                                                          | Not applicable — never invoke it locally                                                                        |
| Authenticated pages       | Not supported                                                                                                                 | Supported (§5)                                                                                                  |

**Rule:** the private-IP allowance in `local-worker` is implemented as a **separate, explicitly-named code path** — never as a bypass flag, environment toggle, or conditional inside the cloud worker's SSRF check. A future reader must not be able to mistake it for a weakening of the cloud guarantee. The cloud check in `packages/worker/src/ssrf/authoritative-check.ts` is not modified by this rule and must stay absolute.

**Rule:** `local-worker` never imports from `packages/worker`'s ladder, routing-memory, or provider modules. Shared contracts go through `@ocular/shared` as usual.

---

## 2. Process architecture

```
Agent (Claude Code / Cursor)
   │  stdio MCP
   ▼
local MCP server (Node/TS)
   │  Unix socket / named pipe, LOOPBACK ONLY
   ▼
supervisor (Go)  ──spawns/kills──►  chrome-headless-shell
   │                                 (CDP)
   └── idle timer, crash restart, lifecycle state
```

**Supervisor language: Go.** Locked. Rationale: native concurrency for the timer/socket/subprocess pattern, standard library covers process management without third-party dependencies, fast compile-iterate loop, and — decisively — it is reviewable by a maintainer who does not write it. Rust's ~5MB lower baseline is immaterial at this scale and its lifetimes, error handling, and async story make AI-assisted iteration materially harder to audit. Do not switch languages without updating this file and `docs/Ocular_PRD_v0.2.md` §3.2.

---

## 3. Lifecycle — three tiers

| State      | Trigger                                           | Resident footprint | What's running                                 |
| ---------- | ------------------------------------------------- | ------------------ | ---------------------------------------------- |
| **Idle**   | No activity > `LOCAL_IDLE_SHUTDOWN_MIN` (~30 min) | ~10-15MB           | Supervisor only. Browser fully terminated      |
| **Recent** | MCP session active, no capture in flight          | ~150-200MB         | Supervisor + warm browser, all contexts closed |
| **Active** | Capture in flight                                 | Transient peak     | Supervisor + browser + one live context        |

**Rule: warm the browser on the MCP `initialize` handshake, not on the first capture call.** An agent session starting is a strong signal a capture is coming. This converts cold start from a per-call cost — which is chrome-devtools-mcp's core latency problem and a large part of why this product exists — into a once-per-session cost the user never perceives.

**Rule:** idle shutdown terminates the browser process outright. Do not "pause," "suspend," or keep a zero-context browser alive to save a future launch. A resident browser at idle is the specific failure this tiering exists to prevent.

**Rule:** all lifecycle thresholds live in `shared/src/constants.ts` alongside the existing performance constants, never inline.

---

## 4. Invisibility — platform requirements

`chrome-headless-shell` contains no windowing code and **cannot** display a window, taskbar entry, or dock icon. That guarantee is structural. Everything that can still break invisibility is packaging, and each item below must be handled explicitly — none are automatic.

| Risk                                           | Platform       | Required mitigation                                                                                                                                                   |
| ---------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console window flashes on supervisor launch    | Windows        | Build with `-ldflags="-H windowsgui"`. A normally-built Go binary is a console app and **will** pop a black window                                                    |
| Dock icon appears                              | macOS          | If distributed as an `.app` bundle, set `LSUIElement=true` in `Info.plist`. A bare binary does not appear in the Dock                                                 |
| Gatekeeper security dialog on first run        | macOS          | Code-sign **and** notarize. An unsigned binary produces a scary dialog at install — the single worst possible first impression for a product sold on invisibility     |
| Firewall "accept incoming connections?" prompt | macOS, Windows | Bind the IPC socket to **loopback only** (`127.0.0.1` / named pipe). Never bind `0.0.0.0`. This prompt directly contradicts the core promise                          |
| Unexpected auto-start                          | All            | Decide explicitly: launch at login vs. on first MCP connection. Whichever is chosen, document it in the installer and make it reversible without editing config files |

**Accepted and unavoidable:** processes are visible in Activity Monitor / Task Manager. This is precisely why §3's idle footprint is a hard requirement rather than a nice-to-have — a developer who goes looking _will_ find Ocular, and what they find should be small.

**One deliberate exception:** the authenticated-profile login flow (§5) requires a real, visible, headed browser window. Login cannot happen headlessly. This is user-initiated, one-time per site, and must be framed explicitly in the UX as the one moment Ocular shows a window. It is not a licence to open windows anywhere else.

**Rule:** any PR that adds a subprocess, opens a socket, or changes packaging must state in its description which of the rows above it touches, or explicitly that it touches none.

---

## 5. Authenticated pages — local profile only

Supersedes `07-security.md` §8's blanket deferral, which was correct for a cloud-only architecture.

**Mechanism:** `local-worker` maintains its own persistent browser profile on the user's device. The user logs into the sites they care about once, inside that profile, via the headed window described in §4. The session is created on the device and stays there.

**Rule:** Ocular never receives, stores, transmits, or logs a credential. No password vault, no OAuth-as-client holding third-party tokens, no reading cookies out of the user's primary browser.

**Rule:** cookie extraction and session replay are permanently out of scope, not merely deferred. Chrome's Device Bound Session Credentials cryptographically binds sessions to the authenticating device specifically to defeat this pattern — GA on Windows as of Chrome 146 and rolling out further. Any approach that _moves_ a session is on a vendor-enforced path to breaking. Authenticating in place is the only durable design.

**Rule:** authenticated captures never enter the cloud cache and never leave the device. See §7.

**Scope:** phase 2 of the local worker. Do not build it before the unauthenticated local path is stable.

---

## 6. Quota

| Path          | Quota                                     | Why                                                     |
| ------------- | ----------------------------------------- | ------------------------------------------------------- |
| Local renders | **Unlimited**                             | The user's machine does the work; marginal cost is zero |
| Cloud renders | Daily-capped, per-rung charge multipliers | See `11-billing-and-quota.md`                           |

**Rule:** unlimited does not mean unauthenticated. `local-worker` must validate an active subscription against the server, or local rendering is trivially freeloadable. Validate on a cached, periodically-refreshed basis — do not make every local capture depend on a live network round-trip, which would reintroduce the latency the local path exists to remove.

**Rule:** define the offline grace behaviour explicitly (how long a cached subscription check remains valid without network). A developer on a plane should not lose their dev loop; an expired subscriber should not get indefinite free rendering.

---

## 7. Local cache

Two caches exist and they are not interchangeable.

| Cache     | Scope                         | Contents                                                                 |
| --------- | ----------------------------- | ------------------------------------------------------------------------ |
| **Local** | The device. Never transmitted | localhost captures, authenticated captures — may contain logged-in state |
| **Cloud** | Shared across all users       | Public URLs only                                                         |

**Rule:** nothing rendered by `local-worker` is ever uploaded to the cloud cache. Not as telemetry, not as a "contribution," not opportunistically for popular URLs. This is what keeps cache poisoning structurally impossible (the cloud cache is populated only by Ocular's own cloud renders) and what keeps authenticated content on the device.

**Rule:** the local cache honours the same `fresh: true` force-refresh parameter and variable-TTL semantics as the cloud cache, so agents see one consistent contract regardless of which path served them.

---

## 8. Rendering fidelity parity

**Rule — must be verified before first release, not assumed:** confirm empirically that `chrome-headless-shell` and Patchright produce near-identical renders of the same page. Both are Chromium-family and should agree, but a visible difference between paths would undermine the product's core promise that what Ocular shows is what the user would see.

Note that headless falls back to SwiftShader software rendering for WebGL where GPU access is unavailable. SwiftShader is conformant — the output is correct, just slower — so this is a latency concern, not a fidelity one. Tune GPU/ANGLE launch flags to get hardware acceleration where the machine supports it, and treat the software path as an acceptable slow fallback rather than a failure.

---

## 9. Local worker checklist — every PR touching `packages/local-worker`

```
[ ] No visible window, dock icon, console flash, or permission prompt introduced (§4)
[ ] IPC still bound to loopback only
[ ] Idle path still fully terminates the browser — no resident browser at idle
[ ] Private-IP allowance still a separate named path, not a flag on the cloud check (§1)
[ ] Cloud worker's authoritative SSRF check untouched
[ ] Nothing from a local render reaches the cloud cache (§7)
[ ] No credential read, stored, transmitted, or logged (§5)
[ ] Subscription validation still enforced on the local path (§6)
[ ] New thresholds added to shared/src/constants.ts, not inline
[ ] Windows build still uses -ldflags="-H windowsgui"
```

---

## 10. Distribution — `npx useocular`

Added Session 26 (Phase 4). `packages/local-worker` publishes to npm as **`useocular`** (`ocular` and the originally-planned fallback `ocular-mcp` were both already taken by unrelated projects — confirmed live against the registry — and `useocular` matches the `useocular.dev` domain already used elsewhere). The published `bin` is `ocular`, so the end-user command is `npx useocular` to install, and the MCP client's own `command` field is `npx` with `args: ["-y", "useocular"]` (or `ocular` directly once installed globally/locally).

**Bundling.** A published npm tarball has no monorepo workspace to resolve `@ocular/shared` from, so `npm run build` (`scripts/bundle.cjs`) runs esbuild over `src/main.ts`, inlining `@ocular/shared` into a single `dist/main.js` while keeping `@modelcontextprotocol/sdk`, `pino`, and `sharp` as real external dependencies (`sharp` ships native bindings a bundler cannot inline). `bin/ocular.js` is a thin shebanged wrapper (`import '../dist/main.js'`) — kept separate so the bundle output never needs hand-editing to add a shebang after every build. Verified via `npm pack --dry-run` + tarball extraction: the packed tarball is ~112KB, six files, zero remaining `@ocular/shared` references in the bundle.

**Supervisor binary distribution.** The Go supervisor is platform-native and cannot be bundled the same way. `src/supervisor/binary-resolver.ts` resolves it in two steps:

1. **Dev build** — `dist-supervisor/` next to the package (produced by `npm run build:supervisor`, gitignored, never shipped in the npm tarball). Always preferred when present, so local development and CI never touch the network.
2. **Checksum-verified download** — on a real install, no dev build exists, so the resolver downloads the current platform's binary from a GitHub Release asset and verifies its SHA-256 against `supervisor-checksums.json` (shipped inside the npm tarball, so its integrity is covered by npm's own package hash) before caching it to `~/.ocular/bin/<version>/` and running it. A platform with no pinned checksum entry is a **hard error**, never a silent fall-through to an unverified download — see the plan's supply-chain finding (#8): a postinstall/first-run fetch of an unverified binary is a real MITM target, and TOFU-trusting a checksum served alongside the same download proves nothing.

`.github/workflows/release-supervisor.yml` cross-compiles all four supported platforms (`win32-x64`, `darwin-x64`, `darwin-arm64`, `linux-x64` — the supervisor is pure Go, no cgo, so a single Linux runner cross-compiles every target with `CGO_ENABLED=0`) on a `supervisor-v*` tag push, publishes them as GitHub Release assets, and commits the resulting checksums back into `supervisor-checksums.json`. **Not yet run for real** — this environment has no Go toolchain to build or verify against, so `supervisor-checksums.json` currently ships with every platform's entry `null`, meaning `resolveSupervisorBinaryPath()` will correctly refuse to download for any platform until a real `supervisor-v*` tag is cut and the workflow runs. Cutting that release is the next concrete step before `npx useocular` works for a real end user on any platform other than a dev machine with `dist-supervisor/` already built locally.

**Rule:** never add `dist-supervisor/` to `package.json`'s `"files"` field — it's a per-developer local build artifact (gitignored), and including a single platform's binary in the published tarball would both bloat the package for every other platform's users and mean that platform's install never exercises the checksum-verified download path.

**No code-signing/notarization for this launch** (confirmed deferred by the founder) — npm-only distribution avoids the Gatekeeper/Apple Developer Program cost. An unsigned macOS binary downloaded this way may still trigger a Gatekeeper prompt on first launch; if that proves disruptive post-launch, notarization is a fast-follow, not a blocker.

---

_Rules v1.2 · 2026-09-02 · Ocular — local execution path_
