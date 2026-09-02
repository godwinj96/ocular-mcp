# Ocular — Brand Identity & Visual System

**Status:** ✅ Locked — 2026-07-11. Source of truth for `packages/website` and any future brand-touching surface (dashboard, docs, social).

> **🟡 Needs review (flagged 2026-09-01, not yet actioned):** `docs/Ocular_PRD_v0.2.md` §8 calls for a positioning shift to "local-led, cloud as amplifier" ("sees your dev server _and_ the live web") now that a local worker exists alongside the cloud path this document was written against. This document predates that pivot and has not been re-read end-to-end against the new positioning — someone who owns brand voice should confirm whether the JTBD framing, visual system, and messaging in this doc still hold, or need a revision pass, before `packages/website`'s copy (Phase 9 of the local-worker implementation plan) is finalized. Not rewritten here on purpose — this is a brand-voice call, not a mechanical doc sync.

**Method note:** This document applies frameworks from two Cursor-native knowledge bases the founder pointed at directly — `~/.cursor/product-intelligence/docs/` (Jobs-to-be-Done, Fogg Behavior Model, Octalysis, Self-Determination Theory, Prospect Theory, Goal Gradient, Hooked Model, design ethics) and `~/.cursor/ui-design-intelligence/docs/` (Müller-Brockmann grid doctrine, Bringhurst typography, Refactoring UI craft, emotional design, WCAG, and teardowns of Apple/Linear/Vercel/Stripe/Arc marketing and dashboard surfaces). These are Cursor agent-persona definitions, not natively invocable as Claude Code subagents — their documented frameworks and cited KB entries are applied directly throughout this document rather than through a subagent call, and cited inline so the reasoning is traceable back to source.

---

## 1. Scope note: which frameworks actually apply here

Most Product Intelligence frameworks (Octalysis' Black-Hat drives CD5–8, Hooked Model, Self-Determination Theory, Prospect Theory, Goal Gradient) are built for **repeat in-product engagement loops** — streaks, notifications, habit formation across many sessions. A one-time marketing page has no such loop, so none of that machinery is forced in here.

What transfers directly to a single-visit marketing page:

- **JTBD** (`frameworks/jobs-to-be-done.md`) — positioning, §2 below.
- **Fogg B=MAP** (`frameworks/fogg-behavior-model.md`) — the single conversion action (connect Ocular) needs Motivation, Ability, and Prompt to converge at the same moment. Ability is the highest-leverage lever per Fogg — reduce friction to try before pushing motivation copy harder. This shapes §5's section order (how-it-works and pricing appear _before_ the FAQ, not after).
- **Octalysis CD1 "Epic Meaning & Calling"** (`frameworks/octalysis-gamification.md`) — the one White-Hat, ethical driver relevant to a single visit: a narrative bigger than the immediate task. This is the seed of §3's "almost magical" framing.
- **`research/design-ethics.md`** — applied as a hard constraint, not a suggestion: no dark patterns, no fake urgency/scarcity, no confirmshaming. See §5's "explicitly excluded" list.

---

## 2. Positioning

### Jobs to be Done (per `decision-models/jtbd-template.md`)

**Functional job:** When I'm building an AI agent that needs to browse the real web, I want it to actually _see_ pages — screenshots, UI structure, extracted assets — without me standing up and babysitting stealth browser infrastructure myself.

**Emotional job:** Relief from owning fragile infra; confidence it will just work; the specific, slightly uncanny satisfaction of watching an agent that couldn't see suddenly see.

**Social job:** Being the developer who found the effortless, absurdly cheap way to do this — "$1/mo and my agent has real eyes" is a legitimately shareable line.

### Forces of Progress

| Force   | What it looks like for Ocular                                                                                                | Product/page lever                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Push    | Rolling your own Playwright + proxy + screenshot pipeline is fragile, expensive, and constantly breaks against bot detection | Name the pain directly in "Why it's reliable"  |
| Pull    | One MCP connection, real stealth, flat $1/mo                                                                                 | Hero value prop + how-it-works                 |
| Anxiety | "Will it actually get past bot detection? Is it secure? Will the bill balloon?"                                              | FAQ answers these directly, doesn't dodge them |
| Habit   | Either hand-rolled scripts, or not doing agent web-vision at all yet                                                         | Low-friction connect flow (Fogg Ability)       |

**Hiring/firing criterion:** functional job (reliable capture) AND emotional job (confidence, not anxiety about blocks or cost) must both land in the first pass over the page, or the visitor "fires" it and bounces — per JTBD's hiring/firing rule, a satisfied functional job doesn't save an unsatisfied emotional one.

### Positioning statement

> Ocular gives AI agents real eyes on the web — enterprise-grade stealth browsing, for $1 a month. No infrastructure to run, no blocks to fight. Connect once; your agent sees everything a human would.

---

## 3. The "almost magical" mechanism

Per the founder's brief: premium, performant, hi-tech, _almost magical_. Grounded in Octalysis CD1 (Epic Meaning) applied ethically (per `research/design-ethics.md` — no manufactured hype, no dark patterns):

The narrative is **not** cute/fantasy magic (no wands, no sparkles). It's Clarke's-Law magic — technology advanced enough to feel uncanny. The concrete framing: _an agent that was blind, and now isn't._

This is dramatized **once**, prominently, in the hero — not sprinkled throughout the page. Every KB teardown read for this document (Apple, Linear, Vercel, Stripe, Arc) independently converges on the same rule: one dominant moment per section, restraint everywhere else. See §6's signature motion moment.

---

## 4. Tone of voice

Confident, precise, restrained — closer to the Linear/Vercel/Stripe marketing register than typical SaaS hype copy.

- No "happy talk," no filler adjectives, short declarative sentences (Krug, `design-principles/usability-clarity.md`).
- Real em dashes (—) and en dashes (–), curly quotes (" " ' '), never `--` or straight ASCII quotes in shipped copy (Bringhurst, `books/elements-of-typographic-style.md` §6).
- Claims are specific and checkable (300 renders/mo, $1/mo, 4 tools, charge-on-success) rather than vague superlatives ("blazing fast," "revolutionary").

---

## 5. Site structure & what's deliberately excluded

Single long-scroll page. Section order follows Fogg B=MAP (ability-first — reduce friction before pushing harder on motivation) and the JTBD forces table above:

1. **Nav** — logo mark + single CTA. No clutter (Krug convention).
2. **Hero** — positioning statement + the signature scan-line reveal animation (§6) + primary CTA. The epic-meaning moment.
3. **How it works** — one tile per real tool: `view_page`, `inspect_ui`, `extract_assets`, `get_quota` (exact names and behavior from `packages/shared/src/schemas/`, not invented).
4. **Why it's reliable** — the stealth-ladder story: proxy/stealth escalation exists because modern sites detect and block naive automation. Names the Push force directly.
5. **Pricing** — `$1/mo`, 300 renders/month, full charge only on a clean render, half-charge if every stealth escalation is exhausted and it still fails, nothing charged on error. (Real values: `MONTHLY_QUOTA=300`, `SUCCESS_CHARGE=1.0`, `EXHAUSTED_FAILURE_CHARGE=0.5` in `packages/shared/src/constants.ts`.) ⚠️ **Stale (2026-09-01):** these are the pre-pivot cloud-only figures. PRD v0.2 splits pricing into local (unlimited, subscription-gated) + cloud (daily cap, not monthly; tiered pricing) — see `docs/rules/11-billing-and-quota.md` §0/§0a/§0b. Covered by this doc's top-of-file needs-review flag; don't treat this bullet's numbers as current.
6. **FAQ** — answers the Anxiety force directly: security posture, what happens when a site blocks the request, cost predictability.
7. **CTA strip + footer** — one action per viewport (Stripe teardown rule).

**Explicitly excluded, and why:** no fake customer logos, no testimonials, no manufactured urgency ("only 3 spots left," countdown timers). `research/design-ethics.md` names this pattern directly as dishonest, and Ocular is pre-launch — there's no real social proof to show yet. Proof comes from specificity (real tool names, real pricing, real architecture), not manufactured trust signals.

---

## 6. Visual system

### 6.1 Color — three-tier tokens (primitive → semantic → component, per `color-theory/semantic-tokens.md`)

Built grey-first (Refactoring UI discipline: neutrals before accent), one static brand accent, dark mode designed rather than inverted (elevation via lighter surfaces, not heavier shadows):

| Token                        | Value                     | Role                                                                                                                                  |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `primitive.navy.950`         | `#0A0E14`                 | Base surface — derived from the logo's background                                                                                     |
| `primitive.navy.900`         | `#12161F`                 | Elevated surface (cards, cells)                                                                                                       |
| `primitive.navy.800`         | `#1A1F2B`                 | Further-elevated surface (hover/active)                                                                                               |
| `semantic.text.primary`      | `#F5F5F5`                 | Headings, body                                                                                                                        |
| `semantic.text.secondary`    | `#9CA3AF`                 | Captions, de-emphasized copy — still ≥4.5:1 on base surface                                                                           |
| `semantic.border.default`    | `#2A2F3B`                 | Dividers, cell outlines                                                                                                               |
| `semantic.color.accent`      | `#7C6CFF` (iris violet)   | The **one** static brand accent — primary CTA and interactive emphasis only, never static headings (Refactoring UI accent discipline) |
| `semantic.color.accent-glow` | `#5EEAD4` (electric cyan) | **Motion-only** — appears exclusively during the hero's scan-line reveal; not a second permanent UI color                             |

Contrast for every text/surface pairing verified against WCAG AA (4.5:1 body, 3:1 large text/UI) during implementation, not assumed from the hex values above.

### 6.2 Typography — counterpoint pairing (Bringhurst, `ui-patterns/typeface-pairing-ui.md`)

- **Display/UI sans:** Geist Sans (or General Sans as fallback) — geometric rounded sans matching the logo's letterforms. Used for headings and all UI chrome. Max two families total (Bringhurst §3.3).
- **Monospace:** Geist Mono (or JetBrains Mono) — reserved for tool names (`view_page`, `inspect_ui`, `extract_assets`, `get_quota`), the price (`$1/mo`), and quota figures. Tabular figures for anything numeric (Bringhurst §7.2 — tabular lining figures for tables/stats, never proportional).
- Body measure ≤75 characters, line-height 1.5 (Bringhurst §2.1–2.2).

### 6.3 Layout — modular bento grid (Müller-Brockmann, `books/grid-systems-in-graphic-design.md`)

- 12-column desktop grid → 4 (tablet) → 2 (mobile), per `ui-patterns/bento-responsive-breakpoints.md`. Hero always first in DOM on mobile — hierarchy survives reflow.
- Every section has exactly one hero cell (max 2 per viewport), sized by importance not content volume, with at least one unequal span ratio per section (e.g. 8+4, 9+3) — per `ui-patterns/grid-proportional-tension.md`'s explicit warning against "equal-grid boredom."
- Scan path: Z-pattern for the how-it-works/feature section (hero top-left → stat tiles top-right → detail center → CTA bottom-right) — `ui-patterns/bento-scan-path.md`'s named recommendation for marketing feature grids.
- One grid break maximum per section (`ui-patterns/grid-break-accent.md`) — the hero's full-bleed screenshot mockup is the one deliberate bleed; every other row snaps back to grid.
- Active whitespace reserved intentionally (Müller-Brockmann §8) — empty cells are a design decision, not something to fill with decorative cards.

### 6.4 Motion — restrained, with one signature moment

Per `ui-patterns/surface-sensory-design.md` and every teardown read (Apple: "motion-heavy reveals without reduced-motion fallback" is a named anti-pattern; Linear/Vercel: "decorative animation on operational dashboards" flagged as anti-pattern): staggered fade-in on scroll (~60–100ms offset per cell), 200–300ms ease, `prefers-reduced-motion` respected with a static fallback (WCAG 2.3.3, non-negotiable).

**The signature moment:** the hero shows a webpage mockup, initially desaturated and slightly blurred. On load, a cyan (`accent-glow`) scan-line sweeps across it once; the mockup resolves to full color and sharpness in its wake. This literally dramatizes "giving an agent sight" — and is the _entire_ motion budget for the page. Everything else stays quiet.

### 6.5 Accessibility (non-negotiable, `accessibility/wcag-mobile-web.md`)

4.5:1 body / 3:1 large-text and UI-component contrast, 44×44px touch targets, visible focus rings, sequential heading order (h1 → h2 per section → h3 per cell), no color-only status indication, reduced-motion fallback for the hero animation.

---

## 7. Logo usage

Source: `Downloads/446079.svg` (primary vector) and `446080.png` (raster fallback / OG image source) — an "Ocular" wordmark with the O rendered as an eye (ring + offset inner circle, reading as an iris with a highlight), white on `primitive.navy.950`, geometric rounded sans, bold weight. This mark is the seed of the whole system above — the eye motif, the dark-navy base, and the geometric sans typography all trace back to it, rather than being chosen independently and then reconciled with an existing logo.

- Minimum clear space: the height of the "O" on all sides.
- Never recolor the mark; use on `primitive.navy.950` or darker only (as shipped).
- Favicon generated from the SVG.

---

## 8. Sources

Direct application of: Christensen/Ulwick (Jobs to be Done), BJ Fogg (Behavior Model), Yu-kai Chou (Octalysis), Krug (_Don't Make Me Think_), Bringhurst (_The Elements of Typographic Style_), Wathan & Schoger (_Refactoring UI_), Müller-Brockmann (_Grid Systems in Graphic Design_), WCAG 2.2 — all as paraphrased/synthesized in the `product-intelligence` and `ui-design-intelligence` Cursor knowledge bases, plus independent visual teardowns of Apple product pages, Linear, Vercel, Stripe, and Arc marketing/dashboard surfaces in the same KB.
