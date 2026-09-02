# Ocular KPIs

The founder's ask was to _identify_ KPIs, not just log numbers ad hoc. This is
that list, with the reasoning for each — including what was deliberately left
out.

## The framing question

Ocular's value proposition is that an agent can see the UI. Its cost is the
tokens that sight consumes in the agent's context, plus the wait. So every KPI
here answers one of three questions:

1. **Is it fast enough to stay in the loop?** A verification step that breaks
   flow gets skipped, and an unused product has no value.
2. **What does one look actually cost?** Both in tokens and in metered renders.
3. **Is what we return worth what it costs?** The measure that matters most and
   is easiest to skip.

## Tier 1 — the ones that decide whether the product is good

| KPI                        | Definition                                                                     | Why it matters                                                                                                                                                   | Baseline (2026-09-02)              |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Local render latency**   | Client-visible round trip for a `view_page` on localhost, cache bypassed       | The core loop. This is the number a developer feels on every verification.                                                                                       | ~1s (11.5s first call — see below) |
| **First-capture auth tax** | Extra latency on the first capture of a session, from the subscription check   | Measured at ~10s: two round trips to remote Postgres (us-east-1) and Redis (eu-central-1) before the browser is touched. Dwarfs every other cost in the product. | ~10s                               |
| **Screenshot phase share** | Screenshot capture as a share of render time                                   | The only phase big enough to be worth optimizing inside the renderer, and the one a GPU could affect.                                                            | 55-65%                             |
| **Cache-hit latency**      | Same call, served from cache                                                   | Determines whether re-checking a page feels free. The gap between this and the above is the cache's whole value.                                                 | 0.87s (13x faster)                 |
| **Tokens per capture**     | Estimated tokens the response adds to agent context, split image vs. a11y tree | The real recurring cost of using Ocular. Splitting it is what makes it actionable — see the baseline findings.                                                   | ~6,400 (10% image)                 |
| **A11y tree signal ratio** | Share of tree nodes carrying an accessible name                                | Distinguishes "rich context" from "expensive noise." A tree that's mostly nameless wrappers is paying image-scale token cost for nothing.                        | 80% of nodes generic               |

## Tier 2 — worth tracking, not yet blocking

| KPI                         | Definition                             | Why                                                                                                        |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Session warm-up cost**    | `initialize` → ready                   | Paid once per session by design. Only a problem if it regresses badly or starts being paid per-call.       |
| **Cloud render latency**    | Same as local, via the queue + worker  | Not yet measured — needs `packages/worker` running. Expected to be far worse; the local path is the pitch. |
| **Screenshot payload size** | KB of the encoded WebP                 | Already governed by the ≤200KB rule. Currently 15KB, nowhere near the cap — so not a live constraint.      |
| **Cache hit rate**          | Hits / total captures, in real use     | Can't be measured from synthetic probes; needs real usage logging over time.                               |
| **Quota burn rate**         | Cloud renders/day against the tier cap | Matters for pricing validation once there are real users. Meaningless with one dogfooding account.         |

## Deliberately not KPIs

- **Screenshot file size as a headline metric.** It's capped, well under the
  cap, and — per the baseline — a rounding error next to the a11y tree. Tracking
  it prominently would aim optimization effort at the wrong half of the payload.
- **Pixel-level fidelity vs. Patchright.** Real and still-open (the parity
  script in DEVLOG), but it's a correctness gate, not a continuous metric.
- **Memory footprint.** `CLAUDE.md` sets the idle target (~10-15MB) and it's a
  real product promise, but it's a threshold to verify before release, not a
  number that moves per-capture.
- **Anything requiring real users.** Retention, captures/session, tool mix.
  Fabricating these from a single dogfooding account would produce numbers that
  look like data and aren't.

## Method notes

Measurements come from `packages/local-worker/scripts/kpi-probe.mjs`. Token
figures are estimates (`(w*h)/750` for images, ~4 bytes/token for JSON) — good
to an order of magnitude, not quotable as cost. See `README.md` for how to run
it and how to read the output honestly.
