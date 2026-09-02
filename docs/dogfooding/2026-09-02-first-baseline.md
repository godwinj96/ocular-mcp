# 2026-09-02 — First baseline: Ocular measured on Ocular

> **Superseded in part by `2026-09-02-phase-breakdown-and-engine.md`.** The
> 11,490ms "cold render" below is **not** render time — ~10s of it is the
> subscription check making two intercontinental database round trips before
> the browser is touched. The actual render is ~1s. Finding 3's "the cold 11.5s
> is a genuine render, not a hidden browser launch" is wrong. Findings 1 and 2
> (a11y tree token cost, tree composition) stand.

First measurements taken through Ocular's own MCP connection, capturing this
repo's website dev server. Session 27.

**Setup:** local worker (dev build, `dist/main.js`) → `chrome-headless-shell`
via the Go supervisor, capturing `http://localhost:5173` (the website's Vite
dev server, running the uncommitted Phase 5 redesign). Cloud `mcp-server` up on
:3000 for the subscription check. Measured with
`packages/local-worker/scripts/kpi-probe.mjs`.

## Numbers

```
initialize:              843 ms

cold (fresh: true)    warm (cached)
  latency   11,490 ms      866 ms
  image        15.0 KB    15.0 KB
  a11y tree    22.5 KB    22.5 KB

a11y tree: 140 nodes — 112 generic (80%), 28 of those with no name at all (20% of all nodes)
est. tokens: ~640 image + ~5,750 a11y tree
```

## Finding 1 — the screenshot is the cheap part

**The a11y tree costs roughly 9x the screenshot in tokens** (~5,750 vs ~640).
The image is 15KB; the tree is 22.5KB of dense JSON, and JSON tokenizes far
worse per byte than an image does per pixel.

This inverts the intuition the pipeline was designed around. `CLAUDE.md`'s
capture-pipeline rules are almost entirely about image economy — downscale to
1568px, WebP ≤200KB, a `detail` knob, never upscale, crop to ROI. All sound,
and all optimizing the 10% of the payload. The current capture doesn't even
approach the image budget: 15KB against a 200KB cap.

Nothing here says the image rules are wrong. It says the a11y tree has been
carrying ~90% of the cost with none of the scrutiny.

## Finding 2 — most of the tree is layout scaffolding

Of 140 nodes, 112 are `generic` and 28 are `generic` **with no accessible name**
— pure wrapper `div`s, contributing coordinates and nesting and nothing else.
The semantically load-bearing nodes are a small minority: 10 headings, 6 links,
4 list items, 3 images, 2 lists.

This bumps into a locked decision, so flagging rather than acting. `CLAUDE.md`:

> **Always ship the accessibility tree alongside the screenshot**, annotated
> with in-viewport vs. below-fold position and coordinates. **Annotate, never
> filter** — the tree's whole advantage is exposing what the screenshot can't
> show.

The rule's reasoning is sound and shouldn't be discarded: filtering by
"is it visible" would destroy the tree's entire purpose, which is telling the
agent about the below-fold content the screenshot structurally cannot show.

But a `generic` node with no name and no role isn't "what the screenshot can't
show" — it's what _nothing_ shows. It's a layout artifact of how the page's
markup nests, and an agent can't act on it. Dropping unnamed generics while
keeping every named and every semantic node — below-fold ones very much
included — would preserve the rule's actual intent while cutting a fifth of the
nodes.

Worth noting the ceiling before anyone gets excited: 20% of nodes is not 20% of
bytes, since wrapper nodes are small. The real win is probably in the coordinate
precision — `"x":88.64012145996094` is 17 significant figures of sub-pixel
position that no agent will ever use. Rounding coordinates to integers likely
saves more than dropping nodes does, and costs nothing semantically.

**Neither change should be made without the founder's call**, since both touch
a locked decision. Recommended framing: rounding is a pure win and should just
happen; unnamed-generic pruning is a genuine judgment call about where
"annotate, never filter" ends.

## Finding 3 — the cache and warm-up work as designed

11,490ms → 866ms is a **13x** improvement, and it's the difference between a
verification step that interrupts flow and one that doesn't.

`initialize` at 843ms confirms the warm-on-initialize design from `CLAUDE.md`
is doing its job — browser startup is paid once per session, not per capture, so
the cold 11.5s is a genuine render, not a hidden browser launch. That was the
explicit fix for "chrome-devtools-mcp's core problem," and it holds up.

11.5s cold is still slow enough to notice. Not diagnosed further here: no
breakdown yet of navigation vs. render vs. a11y extraction vs. encode, and
guessing which dominates would be exactly the kind of undersampled inference
`CLAUDE.md` warns about elsewhere. Instrumenting those phases is the obvious
next measurement.

## What this doesn't cover

- **Cloud path unmeasured.** A public URL routes through BullMQ and needs
  `packages/worker` running; the first attempt at `useocular.dev` timed out
  because it wasn't. Cloud latency, cost, and rung behavior are all unknown.
- **One page, one viewport, one shape of site.** A marketing page with 140 nodes
  is not a canvas/WebGL app or a dense dashboard — the tree ratios in particular
  could look very different, and the primary user is verifying app UI, not
  landing pages.
- **Token figures are estimates**, not billing truth. Fine for the 9x
  comparison that drives Finding 1; not quotable as a cost.
- **No repeat runs.** Single cold and warm sample each — enough for an order of
  magnitude, not for p50/p95 or variance.
