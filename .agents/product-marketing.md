# Product Marketing Context

**Document version:** v2
**Last updated:** 2026-09-05

> **This document is downstream of `CLAUDE.md`, not parallel to it.** Where the two
> disagree, `CLAUDE.md`'s "Positioning guardrails" and "Hard constraints" win and this
> file is wrong and should be corrected. It exists so marketing skills stop re-deriving
> positioning from the codebase and arriving somewhere slightly different each time —
> which is the failure that cost rounds 7 and 8.

## Product Overview

**One-liner:** Read-only visual perception for AI coding agents — your dev server and the open web, from one connection.

**What it does:** Ocular is an MCP server that renders a page and hands the calling agent back a screenshot plus the element tree behind it, annotated with what is in view, what is below the fold, and where each thing sits. It runs two execution paths from one install: a local worker on the developer's own machine (localhost, dev servers, eventually authenticated pages) and a cloud worker for the public web. It never clicks, types, or navigates.

**Product category:** MCP server / AI agent tooling. Customers search for this as "screenshot MCP", "browser MCP", "let Claude see my localhost" — **not** as "visual regression testing" or "browser automation", both of which imply acting on the page.

**Product type:** Developer-tool SaaS, subscription, self-serve.

**Business model:** Basic $2.50/mo ($25/yr) — unlimited localhost captures, 40 open-web requests/day. Pro $20/mo ($180/yr) — 150 open-web requests/day and deeper reach into sites that block automated browsers. Localhost is unmetered on every plan because it is the user's own machine doing the work. Charge-on-success: a clean render costs one request, a render that comes back empty after every approach costs half, an error costs nothing.

---

## Target Audience

**Target companies:** Individual developers and small teams, not enterprises. No procurement, no seat expansion motion, no security review. The buyer is the user.

**Decision-makers:** The developer. One person, spending their own $2.50.

**Primary use case:** A developer running an AI coding agent that is writing or modifying UI, who needs the agent to actually look at the result instead of guessing from the DOM or asking the human to check.

**Jobs to be done:**

- "Let my agent verify its own work without me becoming the eyeballs in the loop."
- "Stop maintaining the screenshot script I wrote six months ago that breaks every time Chrome ships."
- "Let my agent look at a page on the open web I need it to reference, without a second tool."

**Use cases** (ordered by how well they survive the "I already have a workaround" objection):

1. **Canvas, WebGL, and anything drawn rather than marked up.** The element tree can report that a canvas exists and nothing about what it drew. There is no structure to read — this is the one case with no workaround at all, and it is the strongest.
2. A component that compiles, passes tests, and renders as an empty div.
3. An animation, transition, or scroll-driven effect that is supposed to run.
4. Layout that breaks at one width the agent cannot see.
5. A page on the open web the agent needs to read — someone's docs, a pricing table being matched, a link a client sent.

---

## Problems & Pain Points

**Core problem:** An AI coding agent working on UI has no vision. It infers layout from source, cannot tell whether a canvas ever painted, and falls back on asking the developer whether it looks right — which puts the human back in a loop the agent was supposed to close.

**Why alternatives fall short:**

- **Hand-rolled screenshot scripts / Playwright helpers** — work on the day they are written. `docs/Ocular_PRD_v0.2.md` §8.2: _"Most DIY setups never finish or maintain past first-working-version."_ They break on Chrome updates, framework changes, and bot defences, and they are localhost-only.
- **`chrome-devtools-mcp` and similar** — cold-start a browser on the call that needs it, so the agent waits. Localhost-focused; the open web is a separate problem to solve again.
- **Manual screenshot-paste** — works, costs the developer's attention every single time, and does not scale past a few checks.
- **Hosted screenshot APIs** — cannot see localhost at all, which is where the validated demand is.

**What it costs them:** Attention, mostly. The developer becomes the agent's visual cortex, and the agent's autonomy caps out at whatever the human is willing to check. Secondarily: the maintenance tail on the script nobody wants to own.

**Emotional tension:** Not desperation — mild, recurring friction. This is a $2.50 purchase, not a crisis buy. The feeling to write toward is _"I shouldn't still be doing this by hand"_, never fear or urgency.

---

## Competitive Landscape

**Direct:** `chrome-devtools-mcp`, screenshot MCP wrappers, DiffLens. Fall short on cold-start latency, on covering only one side of the localhost/open-web line, and on being someone's side project rather than something maintained.

**Secondary:** Hosted screenshot APIs (cloud-only, cannot reach localhost); visual-regression tools like Percy/Chromatic (built for CI and human review, not for an agent asking a question mid-task).

**Indirect — and the real competitor:** _the developer's own script_, and _not doing agent vision at all yet_. Per `06-brand-identity.md`, Habit is "either hand-rolled scripts, or not doing agent web-vision at all yet." Most of the market is in one of those two states, not evaluating vendors.

---

## Differentiation

**Key differentiators:**

- **Simpler to set up** — one line of MCP config and one sign-in, then never touched again.
- **Lower latency** — the browser is warm before the agent asks, so looking does not cost a cold start.
- **Both sides of the line** — the same connection covers the dev server and the open web, so the agent never hands the job back because the target was on the wrong side.
- **Unobtrusive** — no window, no dock icon, ~10–15MB idle, loopback only, no firewall prompt.
- **Read-only, structurally** — there is no click/type/navigate to trigger, by the user or by a page.

**Why customers choose us:** Not because any single technique is novel — none are. Because it is the version that is maintained, covers both paths, and costs less per month than the coffee they would drink while fixing their own script.

**Defensibility (INTERNAL — never a marketing line):** maintained completeness, plus multi-tenant cache economics that only exist at scale. `CLAUDE.md` and PRD §8.2 both say: **do not position on cleverness.** Diff-based capture, cross-user caching and downscaling all ship free elsewhere.

---

## Objections

| Objection                                          | Response                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I already have something that takes screenshots." | Reach and not thinking about it. Same connection covers the dev server and the open web; it comes up with the session rather than on the call that needs it; it sits at ten-odd megabytes idle. **And concede the exception honestly:** if what you have does all that and you haven't touched it in six months, you don't need this. The concession is what makes the rest credible. |
| "Is it safe to point at my work?"                  | Ocular cannot act on your browser — no click, type, or navigate exists to be triggered. Say exactly that. **Never** say "safe to use with sensitive data": captured content still enters the agent's context and a page can carry text written to steer an agent reading it.                                                                                                          |
| "Will something be running on my machine forever?" | ~10–15MB idle, no window, no dock icon, loopback only. The browser shuts down after ~30 min idle. It is visible in Activity Manager — say so; the honesty is the point.                                                                                                                                                                                                               |
| "Will it get past sites that block bots?"          | Basic clears most of the open web, not all of it. Never imply every site is reachable.                                                                                                                                                                                                                                                                                                |

**Anti-persona:** QA teams wanting CI visual regression; scrapers wanting bulk extraction; anyone who needs the agent to _act_ on a page. The read-only boundary is the product, not a setting — these people should be told no rather than sold to.

---

## Switching Dynamics

**Push:** The script they wrote is fragile, localhost-only, and breaks against a moving target. They are the one maintaining it.
**Pull:** One line of config; already warm when the agent asks; covers both localhost and the open web; $2.50.
**Habit:** Hand-rolled scripts, or not doing agent vision at all yet. **The workaround is the demand signal, not the enemy** — its existence is the proof the market is real.
**Anxiety:** "Is it another background process I'll regret?" "Will the bill move?" "Can it do something to my machine?" Answer all three plainly; the FAQ is the right place.

**Who to write for:** not the developer with no solution, and not the one with a perfect one. **The developer whose thing works today and will break the next time Chrome ships.**

---

## Customer Language

**How they describe the problem (verbatim from research):**

- "screenshot MCP wrappers, cron diff monitors, manual screenshot-paste"
- "let Claude see my localhost"

**Words to use:** look, see, render, comes back, element tree, dev server, the open web, one line, warm, idle, read-only.

**Words to avoid:**

- "safe to use with sensitive data" — forbidden outright.
- "every site", "any site", "the whole web" — base-tier honesty. Use "the open web".
- "blazing fast", "revolutionary", "seamless", "cutting-edge", "premium", "best-in-class" — needing to sell hard signals the invisibility promise already failed.
- Tool names and mechanism in marketing copy (`view_page`, Patchright, `chrome-headless-shell`, warm pools, stealth rungs). Hide the machinery.
- Any phrasing that gives **Ocular** agency. The agent decides and asks; Ocular renders and returns. Never "Ocular checks your work."

**Glossary:**

| Term              | Meaning                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| Local worker      | Runs on the user's machine; localhost and dev servers; unmetered                   |
| Cloud worker      | Renders public URLs; metered against the daily allowance                           |
| Element tree      | The accessibility tree, in plain language. Always annotated, never filtered        |
| Contact sheet     | Motion delivered as tiled stills in one image — Claude accepts no video            |
| Charge-on-success | Clean render costs one; empty-after-all-approaches costs half; error costs nothing |

---

## Brand Voice

**Tone:** Confident, precise, restrained. Linear/Vercel/Stripe register, not SaaS hype.

**Style:** Short declarative sentences. Claims specific and checkable ($2.50/mo, 40/day, ~10–15MB idle, four tools) rather than superlative. Concede real limits in the site's own voice — the concessions are what make the claims believable.

**Personality:** Understated, exact, honest, unembarrassed about being small ("One developer. It does one narrow thing on purpose.").

**Typography rule from `06-brand-identity.md` §4:** real em dashes (—) and curly quotes, never `--` or ASCII quotes. **Note the distinction:** that rule is about the _character_, not the _frequency_. A 2026-09-04 audit found an em-dash in 26% of sentences site-wide (one per 3.9) — that density is a recognisable AI-writing tell and should come down to roughly one in ten. Using the right glyph and using it constantly are different things.

---

## Proof Points

**There is no social proof and none may be invented.** `06-brand-identity.md` §5 excludes fabricated logos and testimonials, and the product is pre-launch. Do not add "trusted by", logo walls, or invented counts — this is the single most common answer to "how do we prove it" and it is closed.

**What can be used instead — and is currently unused:**

| Theme               | Proof available                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The output is real  | The motion contact sheet on the site is genuine `motion_capture` output, regenerated by `scripts/capture-motion-specimen.mjs`. The page never says so. Saying so turns a picture into evidence. |
| The overlay is real | Both demos measure real DOM geometry at runtime, not hand-drawn coordinates                                                                                                                     |
| Honest failure      | Charge-on-success; failures return a reason, never a blank page presented as success                                                                                                            |
| Small footprint     | ~10–15MB idle, loopback-bound, no window, no dock icon                                                                                                                                          |
| Read-only           | Structural, not configurable — there is no action API to disable                                                                                                                                |

---

## Goals

**Business goal:** First paying users from the localhost/coding-agent segment.
**Conversion action:** "Connect your agent" → setup page → MCP config paste + one sign-in.
**Current metrics:** Pre-launch. `useocular.dev` is live; the local worker's release is gated on cutting a real `supervisor-v*` release.

**Packaging: there is no trial. You pay before you try.** Founder, 2026-09-05: _"users must pay before they try it. The price is so low that it wouldn't make any sense."_ Decided, not a gap.

**But the copy still has to say it.** The 2026-09-04 audit found that nothing on the site answers _"do I pay before I try?"_, and deciding the answer does not answer it for the visitor. The page currently replies with silence, and silence at a CTA reads as evasion — the one register this site otherwise avoids. Two places carry it: the CTA rows (which already say `cancel any time`, currently doing a trial's job honestly), and `setup-page.tsx` step 02 _"Sign in once"_, which a reader can easily take for free sign-up before hitting a paywall.

**Write it in the cheap-product register, not the defensive one.** The argument for pay-first is that the price is too low for a trial to be worth anyone's time. That is a confident, ambient-pricing argument and it is on-voice. Anything that sounds like the page is justifying the price violates the "never premium, never best-in-class" guardrail.

---

## Open / Stale

- `research & planning/06-brand-identity.md` carries a **"Needs review"** flag from 2026-09-01: it predates the local-worker pivot, and still says "$1/mo" and frames the product as cloud-stealth-led. Its JTBD forces and tone-of-voice sections were read and used here; its pricing and positioning framing were **not**. It needs a brand-voice owner's pass.
- PRD §9 open decision 1 — cloud cache hits: half-charge or free? **Until this closes, cache copy must claim speed only.** Any wording implying a cache hit is free or discounted commits a pricing decision that has not been made.

---

## Changelog

_Newest first. One line per revision: what changed and why._

- v2 (2026-09-05) — Packaging decided: no trial, pay before you try (founder). Rewrote the
  Goals conversion-gap item from an open packaging question into a copy task, with the
  register to write it in. The gap is now a wording gap, not a pricing one.
- v1 (2026-09-04) — Initial context. Sourced from `CLAUDE.md` positioning guardrails, `docs/Ocular_PRD_v0.2.md` (§8.2 defensibility, the line-15 demand finding), `research & planning/06-brand-identity.md` (JTBD forces, tone of voice), and the shipped site copy. Records the scope test and the words-to-avoid list so downstream skills stop re-deriving positioning.
