# Dogfooding — using Ocular to verify Ocular

Ocular's own visual verification, measured. This directory holds the KPI
definitions, the measurement tooling, and dated findings from actually using
the product on this project.

**Why this exists as its own directory rather than DEVLOG entries:** `DEVLOG.md`
is a chronological narrative — good for "what happened in session N," bad for
"what is our p50 local-render latency, and is it getting worse?" Measurements
need to accumulate somewhere they can be compared across dates. Findings that
change a plan still get a line in DEVLOG pointing here; the numbers live here.

## Contents

| File                                                | What it is                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `kpis.md`                                           | The KPI definitions — what we measure and why those and not others |
| `2026-09-02-first-baseline.md`                      | First real measurements, and what they overturned                  |
| `../../packages/local-worker/scripts/kpi-probe.mjs` | The measurement tool                                               |

## Running a measurement

The probe drives the local worker over real MCP stdio, measuring what an MCP
client actually receives — the bytes that land in an agent's context and get
billed, not the worker's internals.

Three things must be up first:

1. **The cloud `mcp-server`**, on the port `OCULAR_CLOUD_MCP_URL` points at
   (default `http://localhost:3000/mcp`). The local worker validates its
   subscription on startup by calling `get_quota` against it and will not
   start without it — a hard local-dogfooding dependency, and one more
   argument for the auth rework tracked in DEVLOG.

   ```
   node packages/mcp-server/dist/main.js
   ```

2. **A target to capture.** For the local path this must be localhost or a
   private address; a public URL routes to the cloud path instead (which
   additionally needs `packages/worker` running to consume the BullMQ queue).

   ```
   npm run dev --workspace=@ocular/website     # serves localhost:5173
   ```

3. **A built local worker**, since the probe runs the bundle, not the source.

   ```
   npm run build --workspace=useocular
   ```

Then:

```
node packages/local-worker/scripts/kpi-probe.mjs \
  packages/local-worker/dist/main.js \
  http://localhost:5173
```

It reports JSON: `initializeMs`, then a cold pass (`fresh: true`, forcing a
real render) and a warm pass (cacheable), each with latency, the payload split
between screenshot and a11y tree, and a role histogram of the tree.

## Reading the output honestly

- **Token counts are estimates, not billing truth.** Images are approximated at
  `(w*h)/750` and JSON at ~4 bytes/token. They are good to an order of
  magnitude — enough to answer "which half of the payload dominates," which is
  what the probe exists for, and not enough to quote as a cost figure.
- **Latency includes the whole client-visible round trip**, including MCP
  serialization. That's deliberate: it's what a user waits through.
- **A cold pass is not a cold _start_.** `initializeMs` covers supervisor spawn
  and browser warm-up separately, because Ocular warms the browser on
  `initialize` by design — folding that into per-capture latency would
  misattribute a once-per-session cost to every call.
