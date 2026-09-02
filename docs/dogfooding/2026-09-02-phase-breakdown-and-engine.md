# 2026-09-02 — Where the time actually goes, and the engine question

Follow-up to `2026-09-02-first-baseline.md`, which reported an 11.5s cold local
render and speculated about GPU acceleration as a possible remedy. Both of those
turn out to be wrong in instructive ways.

**This document corrects that baseline.** See "Correction" below.

## Method

Added optional phase timing to the local render path
(`packages/local-worker/src/mcp/server.ts`, gated behind `OCULAR_TRACE_PHASES`
so normal runs pay nothing, emitted on stderr so it can't corrupt the MCP
JSON-RPC framing on stdout). Also fills in `meta.durationMs`, which was
previously hardcoded to `0` on every local response.

Target: `http://localhost:5173` (website dev server). Three cache-bypassed
renders.

## The render is ~1 second, not 11.5

```
             run 1    run 2    run 3
total        1083ms    920ms    797ms
  session       3ms      0ms      0ms
  newPage     124ms     67ms     64ms
  navigate    252ms    186ms    166ms
  screenshot  598ms    604ms    479ms   ← 55-65%
  encode      106ms     63ms     88ms
  a11yTree     18ms     11ms     20ms   ← ~2%
```

(`encode` and `a11yTree` run concurrently, so phases don't sum to the total.)

**Screenshot capture dominates** at 55-65% — that's the CDP rasterization step,
the one place where a GPU could plausibly matter. Everything else is small.

## Correction — the 11.5s was never rendering

The baseline's "cold render: 11,490ms" reproduces reliably at the client, but
the traced render underneath it is ~1s. The missing ~10s happens _before the
browser is touched_.

It's the subscription check. Measured directly:

```
get_quota against the local mcp-server:  5.9 seconds
```

`createCloudSubscriptionCheck()` does `connectCloudClient()` → `callTool
('get_quota')` → `close()` — roughly two round trips, which accounts for the
full gap. It runs on the first capture of a session and is then cached for
`LOCAL_SUBSCRIPTION_REFRESH_MIN`, which is exactly the observed pattern: first
capture ~11s, subsequent ones ~1s.

And `get_quota` is slow because of where its data lives: Neon Postgres in
**us-east-1** for the account row, Upstash Redis in **eu-central-1** for the
quota counter. Two intercontinental round trips, from a developer who may be
near neither.

**So the local path — whose entire pitch is "instant, on your machine,
unmetered" — makes two intercontinental database round trips before it will
screenshot localhost.** The felt performance of the product's core loop is
dominated by an auth call, not by browser work.

This reframes the auth item already tracked in DEVLOG (the "users should never
fiddle with API keys" rework) as **a performance problem, not only a UX one**. A
locally-cached credential with background refresh removes ~10s from the first
capture of every session. That is a far larger win than anything in the render
pipeline, and it's already on the roadmap for other reasons.

## The a11y tree is cheap to build, expensive to send

11-20ms to extract. ~5,750 estimated tokens to transmit — **~9x the
screenshot's cost**, per the baseline.

Worth stating plainly because it aims the optimization correctly: there is no
point making the tree walk faster. The entire cost is serialization and
transmission, which is what the format/filtering work in the baseline targets.

## The engine question: `chrome-headless-shell` vs `--headless=new`

Two things needed checking: whether `--headless=new` breaks the invisibility
requirement, and whether the GPU difference is real.

**Invisibility holds.** Launched `--headless=new` and enumerated processes with
a window handle: zero windows from the headless instance. (The only visible
Chrome window belonged to the user's own browsing session.) The premise that
invisibility _requires_ `chrome-headless-shell` does not survive contact — new
headless is windowless too.

**The GPU difference is real,** measured via `WEBGL_debug_renderer_info`:

| Engine                  | WebGL renderer                                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| `chrome-headless-shell` | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device...), SwiftShader driver)` |
| `--headless=new`        | `ANGLE (Microsoft, Microsoft Basic Render Driver..., D3D11)`               |

`chrome-headless-shell` is pinned to **SwiftShader** — pure CPU rasterization.
`--headless=new` runs the **D3D11** pipeline, which is the path a real GPU can
be reached through.

**But it did not reach a real GPU on this machine.** It selected "Microsoft
Basic Render Driver" — Windows' software D3D adapter — not the machine's Intel
UHD 620. So new-headless offers the _architecture_ for hardware acceleration
without automatically delivering it.

**And naive GPU flags made it worse.** Adding `--use-angle=gl --enable-gpu
--ignore-gpu-blocklist` killed WebGL outright (`no context`) — `gl` is the wrong
ANGLE backend on Windows, where `d3d11` is both the default and the correct
choice. Flags copied from Linux-oriented guides are not portable.

## What this means for the three proposed directions

1. **Measure phases first — done, and it redirected the whole thread.** GPU work
   is not the lever. Even eliminating screenshot time entirely saves ~600ms
   against a ~10s auth call. **Priority is the auth/credential rework**, which
   is already tracked and now has a performance justification on top of the UX
   one.
2. **Verify `--headless=new` invisibility — done, it holds.** The engine
   decision can be revisited on its merits; "we must use headless-shell to stay
   invisible" is no longer a valid constraint. Note this is a Windows-only
   result; macOS (Dock icon, `LSUIElement`) and Linux need their own check.
3. **Hybrid (switch engines only for WebGL/canvas pages) — not yet justified.**
   It was proposed as a latency optimization, and latency isn't where the
   problem is. It may still be justified on _fidelity_ grounds — SwiftShader and
   a real GPU can rasterize differently, which matters for a product whose
   stated primary use case includes canvas/WebGL verification — but that's a
   correctness question needing a visual-diff comparison, not a timing one. It
   belongs with the still-open Patchright parity script.

## Caveats

- One machine (HP ProBook 640 G4, Intel UHD 620, Windows), one page, one
  viewport. The phase _ratios_ are more portable than the absolute numbers; a
  machine with a working GPU driver could shift the screenshot share
  substantially.
- Three runs. Enough to see that screenshot dominates; not enough for p95.
- The ~5.9s `get_quota` figure is one measurement from one network location. The
  structural point (two remote DB round trips in the hot path) holds regardless
  of the exact number; the number itself will vary a lot by geography.
- GPU findings are Windows-specific and say nothing about how these engines
  behave on macOS or on a Linux server with a real GPU.
