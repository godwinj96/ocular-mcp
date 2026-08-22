# Claude Code Handoff — Ocular Launch Video

Everything durable now lives in the two attached documents. This file contains only what's specific to _this_ build: the standing orders to install, the build order, and the context Claude Code can't get from the canon.

---

## Part 1 — Paste this as the opening prompt

> I'm building Ocular's launch video. Two documents govern this work, both in `docs/`:
>
> - `ocular-motion-design-bible.md` — the canonical specification for Ocular's motion language (v0.6.0)
> - `ocular-launch-short-v1-storyboard.md` — the first derived instance: a 20s vertical launch short, authored as a SequencePlan
>
> **Read these before writing any code**, in this order: Bible Part 0 (governance), Appendix A (Ontology Registry), Appendix B (Relationship Map), Appendix C (DDR Log). That set is called the Minimum Canonical Context and it is required reading for every session. Then read Chapter IV.16 (Remotion Component Specification) and IV.15 (Material and Render Specification) — these contain the module graph, component interfaces, and exact colour/geometry values you'll implement. Then read the storyboard.
>
> **Context on the repo:** this is a monorepo with `packages/website/` already present. Create `packages/motion/` as a sibling package per §IV.16 rule 15. The website must never import from it; the only artifacts crossing the boundary are rendered video files written to the website's static asset directory.
>
> **Context on what this replaces:** `packages/website/src/remotion/workflow-demo.tsx` is an existing 7-beat composition currently on the site. Leave it untouched and serving. The new hero replaces it only once it renders and is approved. Do not import from it or reuse its components — it predates the Bible and violates it in several specific ways (springs on the logo, glitch effects, particle bursts, grain/dot-grid/vignette texture, letters animating into the logomark). The storyboard's "Prohibited patterns" section lists these explicitly.
>
> **First task:** scaffold `packages/motion/` with the module structure from §IV.16 rule 1, then implement the token modules (`tokens/temporal.ts`, `brand.ts`, `material.ts`, `formats.ts`). Every value in these is stated literally in the Bible — §II.6 for durations and easings, §IV.15 for the neutral scale and geometry, §I.6 for brand constants and formats. This is transcription, not design. Do not invent values; if something you need isn't specified, stop and tell me — that's a canon gap and it needs a DDR, not a guess.
>
> After tokens, build in dependency order: systems → primitives → composition layer. Ask for the validators (`MotionLedger`, plan validation in `SequenceRenderer`) as you build them, not afterward.
>
> **First render target:** do not build all six beats. Build **B3, the Discovery beat**, alone, and get it right in `npx remotion studio` before building outward. It's the composition's thesis and it exercises `AwarenessTimeline`, the Resolution reveal, and depth separation simultaneously. If B3 doesn't feel like perception igniting, nothing downstream will save the video.

---

## Part 2 — Create this as `CLAUDE.md` at the repo root

```markdown
# Ocular Motion — Standing Orders

This repo implements the Ocular Motion Design Bible (`docs/ocular-motion-design-bible.md`).
The Bible is normative. This file is a summary of its hard constraints, not a replacement
for reading it.

## Before any motion work

Read the Minimum Canonical Context first: Bible Part 0, Appendix A (Ontology Registry),
Appendix B (Relationship Map), Appendix C (DDR Log). Then read the chapters governing the
specific task. Do this every session — the canon is large and drift is the failure mode
the governance layer exists to prevent.

## Hard rules

1. **Never call Remotion's `interpolate` directly.** Use `tokenInterpolate` from
   `tokens/temporal.ts`. It is the only sanctioned interpolation entry point (§IV.16 rule 4).
2. **Never write a duration or easing value that is not a token.** The duration scale is
   closed: `t-micro` 4f, `t-swift` 8f, `t-base` 16f, `t-deliberate` 32f, `t-scenic` 64f,
   `t-monumental` 128f at 30fps. The easing set is closed: `e-observe`, `e-reveal`,
   `e-exit`, `e-drift`, `e-shift`. No springs, no bounce, no elastic (§I.2 Law 7).
3. **Single-Writer Rule** (§IV.16 rule 2). `AwarenessTimeline` owns lighting and field
   colour. `ObserverCamera` owns the view transform. `MotionLedger` owns budget validation.
   No scene or primitive writes these channels directly.
4. **Data-Authoring Rule** (§IV.16 rule 3). New videos are authored as `plans/*.plan.ts`
   only. If a task appears to require changing a system or a canon rule, stop and propose
   a DDR — do not proceed.
5. **Never write a colour that is not on the neutral scale or a brand constant** (§IV.15
   rules 1–2). Ocular Ink `#0B0F17`, Ocular White `#FFFFFF`, and `n-000`…`n-900`.
   No accent colours. Hierarchy comes from luminance, focus, and camera attention.
6. **No decoration.** No gradients, noise, grain, dot-grid, vignette, or texture on any
   surface or field (§IV.15 rule 3). No glow, bloom, flare, particles, or emissive
   effects (§II.8 rule 7, §I.6 rule 15). No glitch or chromatic aberration (§IV.15
   anti-patterns).
7. **Motion Budget** (§I.5). Per frame: primary 0.7, subordinate 0.3, ambient 0.1 (max
   two). Total ≤ 1.0. A new primary starts only in the previous primary's final 30%.
   `MotionLedger` enforces this and must throw in development builds.
8. **One Discovery event per composition** (§II.8 rule 3), at 45–55% of duration
   (§III.14 rule 5). Awareness never regresses post-Discovery.
9. **Decrescendo Principle** (§III.14 rule 9). Post-Discovery, per-Beat motion spend is
   monotonically non-increasing and holds are monotonically non-decreasing, ending in the
   composition's longest stillness (≥ 2s).
10. **Silent-First** (§I.6 rule 13). Every composition must be fully legible with zero
    audio. Nothing may depend on sound.

## Repository placement

`packages/motion/` is a separate package from `packages/website/` (§IV.16 rule 15). The
website never imports it. Renders output to the website's static assets as MP4 + WebM +
a PNG poster extracted from the Conviction frame (§IV.16 rule 16).

## When something isn't specified

Stop and ask. An unspecified value is a canon gap, and the correct response is a proposed
DDR (Appendix C schema), not an invented value. Two chapters remain Draft — Focus Field
System (§II.9) and Scene Composition Rules (§III.13) — so gaps in depth-of-field
parameters and spatial grid are expected and should be surfaced, not filled silently.

## Validation is the point

Every normative rule that can become a build-time assertion should. The architecture's
central idea (§IV.16 rationale) is that canon rules become build failures rather than
review-time opinions. `SequenceRenderer` validates the entire plan before rendering and
fails with the violated rule's canon reference.
```

---

## Part 3 — Notes for you, not for Claude Code

**On the loop.** It's now canon (DDR-021) and the storyboard implements it: a B0 rest anchor at `L3` matching frame 599, so the composition opens and closes on the Conviction frame. The narrative consequence is that the story reads as departure-and-return rather than one-way arrival — we begin in lucidity, fall into blindness, climb back. The Conviction frame doubles as the poster.

**On the 16:9 hero.** The storyboard is vertical. The hero variant renders from the same scenes with its own plan file (§IV.16 rule 18) — never by cropping. Ask for both plans once B3 is working.

**What to watch for.** The most likely failure mode is Claude Code producing something that satisfies every rule and still feels inert. The canon prohibits a lot; it can't supply taste. If B3 validates but doesn't move you, that's real information — bring the render back and we'll diagnose whether it's an implementation miss (timing tokens applied but the illumination curve reading flat) or a genuine canon gap (most likely in the two Draft chapters: depth-of-field and spatial composition, which are exactly the two things that carry "polish").

**File size as a canary.** A 20s 1080p hero over ~4 MB means something is violating §IV.15 — almost certainly texture or gradient that crept back in (§IV.16 rule 17).
