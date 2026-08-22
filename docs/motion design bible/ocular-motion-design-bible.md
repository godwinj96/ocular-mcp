# OCULAR MOTION DESIGN BIBLE

**Version:** 0.6.0
**Status:** Engineering layer complete; Loop Closure, repository placement, and delivery canon added (DDR-021–022). Remaining Drafts: Focus Field System (II.9), Scene Composition Rules (III.13).
**Document class:** Normative engineering and design specification.

---

# PART 0 — GOVERNANCE LAYER

This part defines how the Motion Design Bible survives over time. It is normative for the authoring process itself. Nothing in Part 0 describes motion; it describes how motion is documented, versioned, and preserved.

---

## 0.1 Prime Directive

**[Normative]**

The Motion Design Bible is the canonical specification of Ocular's motion language. Its purpose is not to describe existing animations, but to define the reusable systems from which all future Ocular animations can be derived. Whenever a choice exists between documenting an instance and documenting the principle that generated the instance, the principle must be documented. The document must become progressively more deterministic, more internally consistent, and more implementation-ready over time, while preserving conceptual integrity and minimizing ambiguity. Every revision must increase the document's explanatory power without introducing unnecessary complexity.

---

## 0.2 Normative and Informative Sections

**[Normative]**

Every rule-bearing statement in this document carries one of two classifications:

- **[Normative]** — defines rules that future work must follow. Normative statements use "must," "must not," "should," and "should not" with their RFC 2119 meanings.
- **[Informative]** — explains rationale, perception research, examples, psychology, or implementation notes. Informative statements never create obligations.

A section marked **[Normative]** may contain informative sub-paragraphs when explicitly labeled, and vice versa. When a statement's classification is ambiguous, it is informative by default. Implementers resolve conflicts by obeying normative statements only.

---

## 0.3 Canonical Relationship Vocabulary

**[Normative]**

All relationships between canonical entities must be expressed using exactly the following relation types. No ad-hoc relationship phrasing is permitted in the Relationship Map (Appendix B).

| Relation         | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `defines`        | Entity A establishes the canonical definition of B           |
| `depends_on`     | A cannot be implemented or understood without B              |
| `extends`        | A is a specialization or elaboration of B                    |
| `constrains`     | A limits the permissible parameter space of B                |
| `implements`     | A is the concrete mechanism that realizes abstract concept B |
| `interacts_with` | A and B have defined composition behavior                    |
| `supersedes`     | A replaces B; B is retained only historically                |
| `supports`       | A provides evidence or justification for B                   |
| `contradicts`    | A and B cannot both hold; must be resolved by DDR            |
| `requires`       | A has a hard precondition on B at runtime or authoring time  |
| `references`     | A mentions B without dependency                              |
| `is_example_of`  | A is an instance demonstrating B                             |

---

## 0.4 The Chapter Contract

**[Normative]**

Every chapter documenting a primitive or system must contain the following twelve components before it may be marked **Complete**. Chapters missing components are marked **Draft**.

1. **Purpose** — one paragraph stating why the chapter exists.
2. **Canonical Definition** — the single authoritative definition of the chapter's central entity.
3. **Normative Rules** — enumerated, testable rules.
4. **Informative Rationale** — perception, narrative, or engineering justification.
5. **Dependencies** — entities this chapter `depends_on` or `requires`.
6. **Dependents** — known entities that depend on this chapter.
7. **Relationship Map** — relations using the vocabulary of §0.3.
8. **Anti-Patterns** — prohibited behaviors, with the failure mode each produces.
9. **Engineering Abstraction** — responsibilities, interfaces, parameters, ownership.
10. **Remotion Considerations** — how the abstraction maps to Remotion's component and frame model.
11. **Future Extension Points** — where the primitive is expected to grow.
12. **Cross-References** — links to related chapters.

Primitives additionally follow the Five-Layer Documentation Model (Visual, Psychological, Narrative, System, Engineering) inside components 3–10.

---

## 0.5 Design Decision Record (DDR) Protocol

**[Normative]**

Whenever the document adopts, changes, or supersedes a foundational idea, a DDR must be appended to Appendix C using this schema:

```text
DDR-XXX
Version:       document version at which decision took effect
Decision:      one-sentence statement of the new canonical state
Previous:      prior state, or "none"
Reason:        justification traced to perception, narrative, or engineering
Consequences:  affected chapters and entities
```

DDRs are append-only. A DDR is never edited; it is superseded by a later DDR.

---

## 0.6 Versioning Protocol

**[Normative]**

The document uses semantic versioning:

- **MAJOR** — a canonical definition is superseded or the Central Brand Metaphor changes.
- **MINOR** — a new chapter reaches Complete status, or a new canonical entity is introduced.
- **PATCH** — clarification, rationale expansion, or anti-pattern addition with no change to canonical definitions.

Every version increment must be accompanied by at least one DDR when MAJOR or MINOR.

---

## 0.7 Continuation Protocol and Context Window Management

**[Normative]**

Because the document will be authored across multiple sessions and potentially multiple AI conversations, the following rules govern continuation:

1. Every authoring session begins by loading, at minimum: Part 0, the Ontology Registry (Appendix A), the Relationship Map (Appendix B), and the DDR Log (Appendix C). These four artifacts constitute the **Minimum Canonical Context**.
2. When the full document exceeds a practical context window, chapters are loaded on demand, but the Minimum Canonical Context is never omitted.
3. A session must not introduce a new canonical entity without first checking the Ontology Registry for an existing entity covering the same concept.
4. A session must not redefine an existing entity. Extensions are permitted; redefinitions require a DDR and a MAJOR or MINOR version increment.
5. At the end of every session, the Ontology Registry, Relationship Map, and DDR Log are updated before any prose is finalized.

---

## 0.8 Canon Preservation and Ontology Evolution Rules

**[Normative]**

1. Every canonical entity has exactly one preferred name, registered in Appendix A. Synonyms are prohibited in normative text.
2. Renaming an entity requires a DDR, a `supersedes` relation from the new name to the old, and a global consistency pass.
3. When two entities are discovered to overlap, they must be merged or explicitly differentiated via a `contradicts`-resolution DDR. Silent coexistence is prohibited.
4. Informative text may use ordinary language, but must italicize canonical entity names on first use per section to signal ontology membership.

---

## 0.9 Cross-Reference Protocol

**[Normative]**

Cross-references use the form `→ §X.Y (Entity Name)`. A cross-reference to a Draft chapter must be marked `[Draft]`. Forward references to unwritten chapters are permitted only if the target chapter is listed in the Master Outline (§0.11).

---

## 0.10 Completion Criteria

**[Normative]**

The Motion Design Bible is Complete when all of the following hold:

1. Every chapter in the Master Outline satisfies the Chapter Contract.
2. Two competent engineers, working independently from this document and without access to any reference video, would produce launch videos that are recognizably expressions of the same motion language (the **Determinism Test**).
3. Every normative rule traces to at least one of the three foundations: human perception, narrative communication, or engineering constraint.
4. The Ontology Registry contains no orphan entities (entities with zero relationships).
5. No `contradicts` relations remain unresolved.

---

## 0.11 Master Outline

**[Normative]** — This outline is the authoritative structure. Chapters may be added by MINOR version; removed only by MAJOR.

| Part   | Chapter                           | Status   |
| ------ | --------------------------------- | -------- |
| 0      | Governance Layer                  | Complete |
| I.1    | Central Brand Metaphor            | Complete |
| I.2    | Brand Physics                     | Complete |
| I.3    | Perception Model                  | Complete |
| I.4    | Emotional Arc                     | Complete |
| I.5    | Motion Budget Principle           | Complete |
| I.6    | Brand Constants                   | Complete |
| II.6   | Temporal Grammar                  | Complete |
| II.7   | Observer Camera System            | Complete |
| II.8   | Awareness Lighting System         | Complete |
| II.9   | Focus Field System                | Draft    |
| II.10  | Reveal Grammar                    | Complete |
| II.11  | Transition Grammar                | Complete |
| II.12  | Typographic Motion System         | Complete |
| III.13 | Scene Composition Rules           | Draft    |
| III.14 | Sequence Architecture             | Complete |
| IV.15  | Material and Render Specification | Complete |
| IV.16  | Remotion Component Specification  | Complete |
| V      | Reference Deconstruction          | Complete |
| A      | Ontology Registry                 | Living   |
| B      | Relationship Map                  | Living   |
| C      | DDR Log                           | Living   |
| D      | Open Questions                    | Living   |

---

---

# PART I — FOUNDATIONS

---

# Chapter I.1 — Central Brand Metaphor

## Purpose

This chapter establishes the single metaphor from which every other rule in this document derives. It exists so that no future chapter needs to re-argue why Ocular's motion behaves as it does; every chapter instead traces its rules back to this one.

## Canonical Definition

**Central Brand Metaphor** — _Intelligence without perception is incomplete. Ocular does not increase intelligence; Ocular expands perception._

## Normative Rules

1. Every motion primitive must be evaluable against the question: "Does this strengthen the illusion that perception itself is evolving?" A primitive that cannot answer affirmatively must not enter the canon.
2. The following symbolic assignments are canonical and must not be reassigned:
   - Camera movement `implements` **Perception**.
   - Lighting `implements` **Awareness**.
   - Motion (object animation) `implements` **Understanding**.
   - Transitions `implements` **Cognition**.
   - Information hierarchy `implements` **Attention**.
   - Depth `implements` **Comprehension**.
   - Focus `implements` **Certainty**.
3. No animation may communicate "power," "speed," or "excitement" as its primary message. The primary message of every animation is a change in what can be perceived.

## Informative Rationale

**[Informative]** The metaphor is strategically load-bearing because Ocular's product category — giving AI systems visual perception of the web rather than DOM-level abstraction — is itself a perception story. When the motion language and the product thesis share one metaphor, every frame of every video performs double duty: it demonstrates the product's value while decorating nothing. This is why the metaphor sits above Brand Physics rather than beside it.

## Dependencies

None. This is the root node of the ontology.

## Dependents

All chapters. Direct first-order dependents: Brand Physics (I.2), Emotional Arc (I.4), Observer Camera System (II.7), Awareness Lighting System (II.8).

## Anti-Patterns

- **Metaphor drift** — introducing secondary metaphors (e.g., "Ocular as engine," "Ocular as brain") in later chapters. Failure mode: the ontology fragments and animations begin communicating contradictory stories.
- **Metaphor decoration** — invoking eyes, irises, or lens imagery literally in every scene. Failure mode: the metaphor becomes a logo rather than a physics. The metaphor governs _behavior_, not iconography.

## Cross-References

→ §I.2 (Brand Physics), → §I.4 (Emotional Arc), → §II.7 (Observer Camera System), → §II.8 (Awareness Lighting System)

---

# Chapter I.2 — Brand Physics

## Purpose

This chapter converts the Central Brand Metaphor into a small set of universe-level laws. Where the metaphor states what Ocular _means_, Brand Physics states how the Ocular universe _behaves_. Every primitive in Part II is an implementation of one or more of these laws.

## Canonical Definition

**Brand Physics** — the closed set of invariant laws governing how objects, light, cameras, and time behave in any Ocular composition.

## Normative Rules — The Seven Laws

**Law 1 — The Observer Law.**
The camera is a conscious observer, not a rig. It must always behave as though it possesses intention: it anticipates, attends, and confirms. It must never behave as though it is mounted to an object or driven by a beat. _(Implements: Perception.)_

**Law 2 — The Illumination Law.**
Light level is proportional to awareness. Scenes representing pre-Ocular states are dimmer, flatter, and lower-contrast; scenes representing Ocular-enabled states are brighter, deeper, and higher-contrast. Illumination changes must be motivated by narrative state changes, never by aesthetic whim. _(Implements: Awareness.)_

**Law 3 — The Inevitability Law.**
Every motion must appear to be the only motion that could have occurred. This is achieved through anticipation (motion begins before attention arrives, → §II.6), continuity of energy (no motion starts from or ends at a discontinuity), and single-purpose movement (one motion communicates one idea). _(Implements: Understanding.)_

**Law 4 — The Stillness Law.**
Stillness is the default state of the Ocular universe. Motion is an event, not a condition. At any moment, at most one primary motion and one subordinate motion may be active (→ §I.5, Motion Budget Principle). _(Implements: Attention.)_

**Law 5 — The Depth Law.**
The Ocular universe is volumetric. Flat compositions are permitted only as deliberate representations of pre-perception states (DOM trees, code, abstraction). Comprehension is expressed by moving from flat to deep. _(Implements: Comprehension.)_

**Law 6 — The Focus Law.**
Focus is binary in meaning even when continuous in rendering: the subject of certainty is sharp; everything else is soft. Rack-focus events are cognitive events and must coincide with narrative shifts of certainty. _(Implements: Certainty.)_

**Law 7 — The Gravity Law.**
Objects in the Ocular universe have mass but no weight. They decelerate as though massive (long, asymmetric ease-outs) but never fall, bounce, or overshoot beyond the tolerance defined in Temporal Grammar (→ §II.6). Bounce implies playfulness; Ocular's character is deliberate.

## Informative Rationale

**[Informative]** A closed law set exists for a determinism reason: when two engineers disagree about whether an animation is "on-brand," adjudication by taste is non-reproducible, but adjudication by law is. Seven laws is deliberately small — each law must be memorable enough to be applied without consulting the document.

## Dependencies

`depends_on` → Central Brand Metaphor (I.1).

## Dependents

Every Part II primitive. Motion Budget Principle (I.5) `extends` Law 4. Observer Camera System (II.7) `implements` Law 1. Awareness Lighting System (II.8) `implements` Law 2. Temporal Grammar (II.6) `constrains` Laws 3 and 7.

## Anti-Patterns

- **Musical camera** — cutting or moving camera on audio beats rather than attention logic. Violates Law 1; produces "music video" perception rather than "intelligent observer" perception.
- **Aesthetic relighting** — brightening a scene because it looks better, without a narrative awareness change. Violates Law 2; breaks the light-as-awareness code and makes later legitimate lighting changes illegible.
- **Parallel spectacle** — several simultaneous hero motions. Violates Law 4; attention splits and comprehension drops.
- **Elastic easing** — spring or bounce curves on hero elements. Violates Law 7; recodes the brand character from deliberate to playful.

## Engineering Abstraction

Brand Physics is not a component; it is a validation layer. Engineering must expose the laws as lintable constraints where possible: a composition-level check that counts concurrent primary motions (Law 4), an easing whitelist (Law 7), and a lighting-state machine bound to narrative state (Law 2).

## Cross-References

→ §I.1, → §I.5, → §II.6, → §II.7, → §II.8

---

# Chapter I.3 — Perception Model

## Purpose

Every normative rule in this document must trace to human perception, narrative communication, or engineering constraint (§0.10.3). This chapter is the canonical statement of the perception foundation, so that later chapters can cite mechanisms rather than re-deriving them.

## Canonical Definition

**Perception Model** — the set of empirically grounded assumptions about human visual attention and cognition that this document treats as fixed constraints.

## Normative Assumptions

The following assumptions are treated as constraints, not preferences:

1. **Attention is single-threaded for comprehension.** Viewers can track multiple moving objects but can _comprehend_ only one at a time. (Foundation of Law 4 and the Motion Budget Principle.)
2. **Motion onset captures attention involuntarily.** A motion beginning in the periphery will pull gaze within roughly 100–250 ms. Therefore every motion onset is an attention command, and unintended onsets are attention theft.
3. **Anticipatory motion is read as intention.** When a camera or object begins moving toward a target 150–300 ms before that target becomes narratively relevant, viewers attribute intention to the mover. This window is the **Anticipation Lead** (canonical parameter, → §II.6).
4. **Smooth pursuit has a comfort ceiling.** Sustained camera translation above approximately 12°–15° of visual field per second forces saccades instead of pursuit and reads as haste. Ocular's observer never induces saccades by speed.
5. **Contrast defines hierarchy faster than position.** Luminance contrast establishes what matters within the first fixation (~200 ms), before layout is parsed. Lighting therefore outranks layout as a hierarchy tool.
6. **Continuity of energy is read as physical plausibility.** Velocity discontinuities (instant starts/stops) are perceived pre-attentively as errors or cuts. Asymmetric ease curves that preserve C1 continuity read as mass and deliberateness.
7. **Blur encodes irrelevance, not absence.** Defocused elements are held in peripheral awareness and can be promoted cheaply; removed elements must be re-introduced expensively. This favors focus manipulation over element removal for managing complexity.

## Informative Rationale

**[Informative]** These assumptions are stated at the level of usable engineering constants rather than literature citations because the document's consumers are implementers. Where a precise threshold is given (e.g., 150–300 ms Anticipation Lead), the range is canonical: implementations choose a value inside the range and hold it constant per project.

## Dependencies

None external; this is a foundation node. `supports` → Brand Physics (I.2).

## Dependents

Temporal Grammar (II.6) `depends_on` assumptions 2, 3, 6. Observer Camera System (II.7) `depends_on` assumptions 3, 4. Awareness Lighting System (II.8) `depends_on` assumption 5. Focus Field System (II.9) `depends_on` assumption 7. Motion Budget Principle (I.5) `depends_on` assumption 1.

## Anti-Patterns

- **Citing taste where a mechanism exists.** Any future rule justified as "feels right" when one of these assumptions could justify it instead is a documentation defect.

## Cross-References

→ §I.2, → §I.5, → §II.6, → §II.7, → §II.8

---

# Chapter I.4 — Emotional Arc

## Purpose

This chapter defines the canonical emotional progression that every Ocular launch narrative must traverse, and binds each emotional stage to the systems that are permitted to express it. It converts the emotional journey from aspiration into specification.

## Canonical Definition

**Emotional Arc** — the ordered ten-stage emotional progression — Curiosity, Recognition, Tension, Possibility, Discovery, Confidence, Empowerment, Clarity, Scale, Conviction — through which every Ocular launch narrative must guide the viewer.

## Normative Rules

1. The ten stages must occur in canonical order. Stages may be compressed or merged in short-form assets, but never reordered.
2. Each stage has a canonical expressive assignment. The stage must be expressed primarily through its assigned systems:

| Stage       | Primary System             | Canonical Expression                               |
| ----------- | -------------------------- | -------------------------------------------------- |
| Curiosity   | Observer Camera            | Slow approach toward an under-lit subject          |
| Recognition | Typographic Motion         | Naming the familiar problem in stillness           |
| Tension     | Awareness Lighting         | Dim, flat, low-contrast pre-perception state       |
| Possibility | Focus Field                | First rack-focus toward the previously soft        |
| Discovery   | Awareness Lighting + Depth | Illumination rise; flat space gains volume         |
| Confidence  | Temporal Grammar           | Longer holds; decelerating rhythm                  |
| Empowerment | Reveal Grammar             | Capabilities revealed by the observer, in sequence |
| Clarity     | Motion Budget              | Near-total stillness; single subject, full focus   |
| Scale       | Observer Camera            | Dolly-out revealing extent without haste           |
| Conviction  | All systems at rest        | Final stillness; maximum brightness; logo state    |

3. Emotional intensity must be produced by _withholding then granting perception_ (light, depth, focus), never by increasing motion quantity or speed.
4. The arc's midpoint (Discovery) is the single largest illumination change in any video and must be unique — one Discovery event per narrative.

## Informative Rationale

**[Informative]** Binding emotions to systems is what makes the arc implementable. "Make the viewer feel confident" is not testable; "express Confidence through longer holds and decelerating rhythm per Temporal Grammar" is. The Discovery-uniqueness rule exists because illumination changes are the highest-salience event in the language (Perception Model, assumption 5); repeating them devalues the narrative's central moment.

## Dependencies

`depends_on` → Central Brand Metaphor (I.1), Brand Physics (I.2). `requires` → all Part II primitives for expression.

## Dependents

Sequence Architecture (III.14) `implements` this arc at the timeline level.

## Anti-Patterns

- **Excitement substitution** — expressing Empowerment or Scale through speed, particle density, or cut frequency. Failure mode: the video communicates spectacle, which is explicitly not Ocular's identity.
- **Double Discovery** — multiple large illumination events. Failure mode: the light-as-awareness code loses meaning.

## Cross-References

→ §I.1, → §II.6, → §II.7, → §II.8, → §III.14 [Draft]

---

# Chapter I.5 — Motion Budget Principle

## Purpose

This chapter defines the canonical constraint governing how much motion may exist at any moment. It is the primary mechanism by which the Stillness Law (Brand Physics, Law 4) becomes enforceable.

## Canonical Definition

**Motion Budget Principle** — at any instant, a composition possesses a fixed attention budget of 1.0, allocated across all concurrent motions; the budget may never be exceeded, and unallocated budget expresses itself as stillness.

## Normative Rules

1. Canonical motion costs:
   - **Primary motion** (the narrative subject's motion, or a camera move) — cost 0.7.
   - **Subordinate motion** (a single supporting element responding to the primary) — cost 0.3.
   - **Ambient motion** (environmental life: subtle parallax, light drift) — cost 0.1 each, maximum two.
2. A camera move and an object's primary motion may not co-occur unless the camera is tracking that object; tracking merges them into one primary motion.
3. Budget transitions must be sequential: a new primary motion may begin only after the previous primary motion has entered its deceleration phase (final 30% of its duration).
4. Ambient motion must be imperceptible as motion — detectable only by its absence. If a frame-step reveals obvious ambient displacement, ambient amplitude is too high.
5. During the Clarity and Conviction stages of the Emotional Arc, total spend must not exceed 0.1.

## Informative Rationale

**[Informative]** The numeric budget exists purely for adjudication and linting. The numbers are not perceptual measurements; they are a contract that makes "too much is happening" a computable claim rather than an argument. Rule 3 operationalizes the Inevitability Law: overlapping a new motion with the deceleration of the old one preserves continuity of energy while never presenting two competing accelerations.

## Dependencies

`extends` → Brand Physics Law 4. `depends_on` → Perception Model assumption 1.

## Dependents

All Part II primitives `constrained_by` this principle (expressed in the Relationship Map as Motion Budget Principle `constrains` each primitive).

## Anti-Patterns

- **Budget laundering** — reclassifying an attention-demanding motion as "ambient" to fit the budget. Test: if removing the motion changes the narrative, it was not ambient.
- **Choreographed simultaneity** — multiple elements moving in synchronized formation as one "motion." Formation motion of N elements is a single primary motion only if the elements share one velocity field; otherwise it is N motions.

## Engineering Abstraction

Expose a composition-scoped `MotionLedger` responsibility: every animated element registers its class (primary / subordinate / ambient) and active interval; the ledger validates the budget per frame and fails loudly in development builds.

## Cross-References

→ §I.2, → §I.3, → §II.6

---

# Chapter I.6 — Brand Constants

## Purpose

This chapter registers the fixed, non-motion brand assets — color, logo anatomy, format targets, and audio policy — as canonical constants, and binds them to the motion systems that consume them. It exists so that motion chapters never restate brand values and brand values never drift between projects.

## Canonical Definition

**Brand Constants** — the closed set of invariant brand values (colors, logo components, format targets, audio policy) that all Ocular compositions must consume without modification.

## Normative Rules

### Color Canon (V)

1. The brand palette contains exactly two canonical colors:
   - **Ocular Ink** — `#0B0F17` (rgb 11, 15, 23). A near-black blue-ink. Measured directly from the master logo assets; this value is exact, not approximate.
   - **Ocular White** — `#FFFFFF`.
2. **The Polarity Rule.** The two brand colors are canonically bound to the poles of the Awareness Lighting System (→ §II.8): Ocular Ink is the color of the `L0-blind` environment; Ocular White is the color of the `L3-lucid` environment. Every launch narrative therefore traverses Ink → White. Intermediate awareness states are interpolations along this axis, tinted by the temperature bindings of §II.8 rule 5. The temperature tint applies to light and environment only; Ocular Ink itself is invariant and is never warmed, cooled, or transparent-faded below 100% opacity when used as the logo color.
3. Accent colors are prohibited in the motion language until introduced by DDR. Hierarchy is expressed through luminance, focus, and camera attention — never hue.
4. The Conviction frame (final state of every narrative, → §I.4) is canonical: the Ocular wordmark in Ocular Ink, centered on an Ocular White field, at rest, at `L3-lucid`.

### Logo Anatomy (V)

5. Canonical logo components:
   - **Logomark** — a perfect circle rendered as a thick ring (annulus), whose inner edge is intersected by a smaller circle — the **Catchlight** — whose center sits at **40° from the vertical axis, clockwise (upper-right)** on the ring's inner edge; the lens-shaped intersection region is filled. The construction reads as an iris with a specular highlight. These construction values are exact and immutable.
   - **Catchlight** — the canonical name for the 40° intersecting circle and its filled lens region. The Catchlight is the only brand element permitted to represent "perception igniting."
   - **Wordmark** — "Ocular" set in **Poppins Bold**, with the initial O replaced by the Logomark (the perfect-circle construction above, not Poppins' native O). Wordmark tracking, and the Logomark-to-letterform size ratio, are as fixed in the master asset and must not be redrawn per project.
6. Two color variants exist and their usage is bound to awareness state: the Ocular White variant appears on environments at or below `L1-aware`; the Ocular Ink variant appears on environments at `L2-perceiving` and above. Mid-transition crossfades between variants are prohibited; the variant switch, when needed, occurs during a Transition Grammar boundary [Draft §II.11].

### Logo Motion Rules (V, N, S)

7. **The Sigil Reveal** — the canonical logo entrance, defined in **contrast-relative** terms so that it executes identically at either pole of the Polarity Rule. Sequence: (a) the Logomark ring is present at ≤ 8% luminance contrast against the current field, in whichever variant the field's awareness state dictates (§I.6 rule 6); (b) the Catchlight resolves from defocus over `t-base` using `e-shift` — this is the moment perception ignites, and it is the invariant core of the reveal at every polarity; (c) the field's awareness state advances one step per the Awareness Lighting System, carrying the mark's contrast from ≤ 8% to full; (d) the wordmark enters as a single reveal (one motion, never per-letter) over `t-deliberate` using `e-reveal`. The Sigil Reveal is a primary motion (cost 0.7) and, when used as a narrative climax, may coincide with the Discovery event.
   - **Dark-pole instance** (`L0`/`L1` field): White-variant mark emerging as light arrives.
   - **Light-pole instance** (`L3` field, the canonical Conviction frame): Ink-variant mark emerging as the field crests to white — the mark darkens into legibility while the world brightens. Contrast travel is identical; only its direction differs.
8. The Logomark must never rotate, bounce, morph, or pulse. The Catchlight must never blink, travel around the ring, or duplicate. The logo is an eye at rest, not an eye performing.
9. Minimum stillness after any logo entrance: `t-deliberate` before any subsequent motion.

### The Gaze Ring (V, N, S)

10. **Gaze Ring** — canonical entity: the visible indicator of machine attention; Ocular's perception made observable inside Idealized UI. It is the product's protagonist in any composition depicting the agent at work.
11. Construction is derived from the Logomark and must not be redrawn: a perfect circle, stroke weight equal to the Logomark's ring thickness scaled proportionally, carrying a Catchlight at 40° clockwise from vertical. The Gaze Ring is the Logomark rendered as an instrument rather than a mark; the family resemblance is the point.
12. Behavior: the Gaze Ring obeys the Attention Cycle (→ §II.7 rule 1) — anticipate, attend, confirm — at element scale. It travels along gently curved paths, never straight rails, and always decelerates into its target. It never blinks, pulses, spins, or trails particles.
13. The Gaze Ring exists only at `L1-aware` and above. At `L0-blind` the agent's cursor is a plain, ringless pointer: the absence of the Gaze Ring _is_ the depiction of blindness, and is the single most important narrative use of the entity.
14. At most one Gaze Ring may be active in a composition. Multiple simultaneous rings depict parallel attention, which contradicts the Perception Model (assumption 1).

### Success and State Grammar (V)

15. Idealized UI state changes (confirmation, completion, validation) are expressed exclusively through: luminance step of the affected element, focus resolution, and the Gaze Ring's confirm settle. Accent color flashes, checkmark pops, and glow bursts are prohibited (extends rule 3 and §II.8 rule 7). Success in the Ocular universe looks like something becoming _clear_, not something becoming _green_.

### Format Canon (S, E)

10. Canonical output formats:

| Format token        | Aspect          | Duration class | Primary use                               |
| ------------------- | --------------- | -------------- | ----------------------------------------- |
| `f-social-vertical` | 9:16, 1080×1920 | 20–30 s        | Shorts / Reels / TikTok (autoplay, muted) |
| `f-social-square`   | 1:1, 1080×1080  | 20–30 s        | Feed placements                           |
| `f-web-hero`        | 16:9, 1920×1080 | 60–90 s        | Website hero, full narrative              |

11. All formats share one canonical frame rate (30 fps, → §II.6) and one Emotional Arc; short formats express the arc via the compression rules of Sequence Architecture [Draft §III.14], never by reordering stages.
12. Compositions must be authored safe-area-first for `f-social-vertical`: primary subjects and typography inside the central 80% vertically, avoiding platform UI occlusion zones (top ~12%, bottom ~15%).

### Audio Policy (S)

13. **The Silent-First Principle.** No score currently exists, and the dominant distribution context (social autoplay) is muted. Therefore every Ocular composition must be fully legible with zero audio: all rhythm, emphasis, and emotional progression derive exclusively from Temporal Grammar, the Observer Camera System, and the Awareness Lighting System. Audio, if later introduced, may only reinforce timing that already exists; it must never motivate timing (this also preserves the beat-cutting prohibition, → §I.2 anti-patterns).

### Product Representation Policy (S)

14. **The Idealized UI Rule.** No real screen captures appear in Ocular videos. All product UI is rebuilt as stylized recreations that natively obey the Awareness Lighting System (they are lit, not graded), the two-color palette plus neutral grays derived from the Ink↔White axis, and the Motion Budget Principle. Rebuilt UI is a set actor, not a screenshot: it exists at whatever fidelity the narrative requires and no more.

## Informative Rationale

**[Informative]** The Polarity Rule is the chapter's most consequential decision: a two-color brand could have been a constraint, but binding Ink and White to the blindness↔lucidity axis makes the entire brand palette itself an implementation of the Central Brand Metaphor — the colors are not decorated by the story; they are the story's coordinate system. The Silent-First Principle is likewise a strength rather than a budget concession: a motion language that requires sound to be legible would fail in its primary distribution context regardless of score quality.

## Dependencies

`depends_on` → Central Brand Metaphor (I.1), Awareness Lighting System (II.8), Temporal Grammar (II.6). `constrained_by` → Motion Budget Principle (I.5).

## Dependents

Typographic Motion System (II.12) [Draft] `requires` the Wordmark constants. Sequence Architecture (III.14) [Draft] `requires` the Format Canon. Reveal Grammar (II.10) [Draft]: the Sigil Reveal `is_example_of` a Resolution-class reveal.

## Anti-Patterns

- **Accent creep** — introducing a highlight color "for CTAs." Failure mode: hue begins competing with luminance as the hierarchy channel and the Awareness code degrades.
- **Logo puppetry** — animating the Catchlight as a character. Failure mode: the mark shifts from perception-at-rest to mascot; brand character recodes from deliberate to playful.
- **Landscape-first authoring** — composing for 16:9 and cropping to 9:16. Failure mode: subjects fall into occlusion zones; the Observer Camera's framing intent is destroyed by the crop.

## Engineering Abstraction (E)

Brand Constants ship inside the Motion Token System [Draft §IV.16] as a `brand.ts` module: `INK`, `WHITE`, format descriptors, safe-area insets, and a `SigilReveal` component owning rules 7–9. The logo asset pair (Ink/White variants of Logomark and Wordmark) are the only permitted logo sources; no per-project redraws.

## Remotion Considerations

Formats map to distinct Remotion compositions sharing one scene graph; the `f-social-vertical` composition is the authoring default (rule 12). The Ink↔White environment interpolation is exposed through the same CSS custom properties as `AwarenessTimeline` (→ §II.8), so the Polarity Rule requires no additional plumbing.

## Future Extension Points

Derived neutral-gray scale for Idealized UI; favicon/app-icon motion variants; confirmation of licensed Poppins weights beyond Bold (600/500/400 assumed available via Google Fonts' open license).

## Cross-References

→ §I.1, → §I.4, → §II.6, → §II.8, → §II.10 [Draft], → §III.14 [Draft], → §IV.16 [Draft]

---

---

# PART II — CORE PRIMITIVES

Each primitive chapter follows the Chapter Contract and the Five-Layer Documentation Model. Layers are marked inline: **V** (Visual), **P** (Psychological), **N** (Narrative), **S** (System), **E** (Engineering).

---

# Chapter II.6 — Temporal Grammar

## Purpose

This chapter defines the canonical vocabulary of time: durations, easing curves, and rhythm rules. All other primitives consume these tokens; none may define their own timing values. Temporal Grammar is therefore the lowest-level shared dependency in Part II.

## Canonical Definition

**Temporal Grammar** — the closed set of canonical duration tokens, easing tokens, and rhythm rules from which all timing in the Ocular motion language is composed.

## Normative Rules

### Frame Basis

1. The canonical frame rate is **30 fps**. All duration tokens are defined in milliseconds and must resolve to integer frame counts at 30 fps.

### Duration Tokens

2. The canonical duration scale:

| Token          | Duration | Frames @30 | Canonical Use                                     |
| -------------- | -------- | ---------- | ------------------------------------------------- |
| `t-micro`      | 133 ms   | 4          | Opacity ticks, cursor states, micro-confirmations |
| `t-swift`      | 267 ms   | 8          | Subordinate element entrances, focus shifts       |
| `t-base`       | 533 ms   | 16         | Standard element reveals, typographic entrances   |
| `t-deliberate` | 1067 ms  | 32         | Primary reveals, camera attention shifts          |
| `t-scenic`     | 2133 ms  | 64         | Camera approaches, illumination transitions       |
| `t-monumental` | 4267 ms  | 128        | Discovery event, final dolly-out                  |

3. Durations outside the scale are prohibited. Where a motion seems to need an intermediate value, the motion is decomposed or the nearest token is used.
4. **Anticipation Lead** — canonical parameter, value **200 ms (6 frames)**, permitted range 150–300 ms fixed per project. Camera and lighting responses begin one Anticipation Lead before the narrative event they attend to (Perception Model, assumption 3).

### Easing Tokens

5. The canonical easing set. All values are cubic-bezier control points. No other curves are permitted on hero or subordinate elements.

| Token       | Curve                    | Character                         | Canonical Use                            |
| ----------- | ------------------------ | --------------------------------- | ---------------------------------------- |
| `e-observe` | (0.30, 0.00, 0.10, 1.00) | Long asymmetric settle            | Camera moves; all Observer Camera motion |
| `e-reveal`  | (0.20, 0.00, 0.00, 1.00) | Fast attack, massive decay        | Element entrances, reveals               |
| `e-exit`    | (0.60, 0.00, 0.90, 1.00) | Slow release, committed departure | Element exits                            |
| `e-drift`   | (0.40, 0.00, 0.60, 1.00) | Near-linear, breathing            | Ambient motion only                      |
| `e-shift`   | (0.45, 0.00, 0.15, 1.00) | Balanced cognitive turn           | Focus racks, lighting transitions        |

6. Overshoot tolerance: maximum 0.5% of travel distance, permitted only on `e-reveal`, and only for elements smaller than 25% of frame height. Springs, bounces, and elastic curves are prohibited (Brand Physics, Law 7).
7. Deceleration asymmetry is invariant: every canonical curve spends a minimum of 60% of its duration below 50% of peak velocity. This is the measurable definition of "deliberate."

### Rhythm Rules

8. Consecutive primary motions must alternate duration classes by at least one step (e.g., `t-deliberate` → `t-base` or `t-scenic`, never `t-deliberate` → `t-deliberate` more than twice in sequence). Uniform rhythm reads as mechanical; Ocular's observer breathes.
9. Hold time (full stillness) between primary motions must be ≥ 50% of the preceding motion's duration, except during the Empowerment stage where it may compress to 25%.

## Informative Rationale

**[Informative — P]** The 60% deceleration invariant (rule 7) is the engine of perceived mass and intention: viewers read prolonged deceleration as an agent settling attention rather than an object obeying a keyframe (Perception Model, assumption 6). The duration scale doubles at each step because perceptual duration discrimination is roughly logarithmic; adjacent tokens are reliably distinguishable, which keeps the rhythm rules meaningful.

**[Informative — N]** Tokens carry narrative register: `t-micro` through `t-base` narrate _what the product does_; `t-deliberate` through `t-monumental` narrate _what the observer understands_. Assigning a hero realization a `t-base` duration under-weights it narratively even if it looks acceptable.

## Dependencies

`depends_on` → Perception Model (I.3), Brand Physics Laws 3 and 7.

## Dependents

All other Part II primitives `require` Temporal Grammar tokens.

## Anti-Patterns

- **Token drift** — hand-tuning a duration to 480 ms "because it feels better." Failure mode: the rhythm system silently dissolves and the Determinism Test fails.
- **Easing decoration** — using `e-observe` on UI elements to make them feel "cinematic." Each easing token is bound to its semantic role; misuse erodes the code.

## Engineering Abstraction (E)

Tokens are a single exported constant module (`temporal.ts`): duration tokens in frames, easing tokens as bezier tuples, plus `ANTICIPATION_LEAD_FRAMES`. Interpolation helpers accept tokens, not raw numbers. Development builds warn on any interpolation constructed from a non-token value.

## Remotion Considerations

All durations expressed in frames via the token module; `useCurrentFrame()` arithmetic must reference token constants. Bezier easings map directly to Remotion's `Easing.bezier`. The Anticipation Lead is implemented by offsetting `Sequence` start frames negatively relative to the narrative event's frame.

## Future Extension Points

Audio-alignment rules (how tokens relate to score, given that camera must never cut on beats); variable-frame-rate export policies.

## Cross-References

→ §I.2, → §I.3, → §I.5, → §II.7, → §II.8

---

# Chapter II.7 — Observer Camera System

## Purpose

This chapter defines the camera as the protagonist of the Ocular motion language. The camera is the visible implementation of Perception itself (Central Brand Metaphor); this chapter specifies how an intentional observer behaves in measurable terms.

## Canonical Definition

**Observer Camera System** — the camera model in which all framing and movement expresses the behavior of a conscious, deliberate observer whose attention anticipates, attends to, and confirms narrative subjects.

## Normative Rules

### The Attention Cycle (V, S)

1. Every camera behavior is composed from exactly three canonical phases, always in order:
   - **Anticipate** — the camera begins moving toward the next subject one Anticipation Lead before that subject becomes narratively active. Velocity during Anticipate never exceeds 20% of the move's peak velocity.
   - **Attend** — the main translation/rotation toward the subject, using `e-observe`, duration `t-deliberate` or `t-scenic`.
   - **Confirm** — a terminal micro-settle: the final ≤ 1% of travel elapses over the last 20% of duration, ending in absolute stillness of ≥ 50% of the move's duration (Temporal Grammar, rule 9).
2. The camera must never cut between subjects within a scene. Attention travels; it does not teleport. Cuts are reserved for scene boundaries (→ §II.11 Transition Grammar [Draft]).

### Movement Vocabulary (V)

3. Permitted moves: dolly (in/out), truck, pedestal, pan ≤ 15°, tilt ≤ 10°, and combinations thereof. Prohibited: roll (except ≤ 0.5° ambient drift), whip pans, crash zooms, handheld noise, orbit exceeding 30° per move.
4. Peak angular velocity must remain below the smooth-pursuit ceiling (Perception Model, assumption 4): subjects must be trackable without saccades.
5. The camera approaches subjects along gently curved paths (single-arc splines), never perfectly straight rails. Curvature maximum: lateral deviation ≤ 8% of path length. Straight rails read as mechanical; excessive curves read as wandering.

### Attitude Rules (P, N)

6. The camera never reacts. It anticipates. If a subject appears before the camera begins moving toward it, the timing is defective by definition.
7. The camera never expresses excitement. Emphasis is expressed by _slowing down and approaching_, not by speeding up.
8. Dolly-in signifies increasing certainty; dolly-out signifies comprehension of scale. These assignments are canonical and may not be swapped.

## Informative Rationale

**[Informative — P]** The Anticipate phase converts the camera from recording device into character. Viewers attribute agency to any entity whose motion precedes the event it relates to (assumption 3); this attribution is the entire mechanism by which "Ocular gives AI vision" is _felt_ rather than stated. **[Informative — N]** Rule 8 gives camera depth a stable narrative meaning, which lets Sequence Architecture use camera direction as a storytelling primitive without per-scene explanation.

## Dependencies

`implements` → Brand Physics Law 1. `depends_on` → Perception Model (I.3). `requires` → Temporal Grammar (II.6). `constrained_by` → Motion Budget Principle (I.5).

## Dependents

Emotional Arc stages Curiosity and Scale; Sequence Architecture (III.14) [Draft].

## Anti-Patterns

- **Reactive camera** — camera motion beginning at or after subject onset. Failure mode: the observer demotes to spectator; the brand metaphor silently inverts.
- **Tour-guide camera** — continuous motion without Confirm phases. Failure mode: no moment of stillness means no moment of understanding; violates the Stillness Law.
- **Beat cutting** — synchronizing moves to the score. Violates Law 1 (→ Brand Physics anti-patterns).

## Engineering Abstraction (E)

A single `ObserverCamera` responsibility owns all view transforms. Interface: an ordered list of `AttentionTarget { subject, arrivalFrame, framing }`. The system derives Anticipate onset (arrival − attend duration − Anticipation Lead), constructs the arc path, applies `e-observe`, and enforces the Confirm settle. No scene may manipulate the view transform directly; scenes declare targets, the camera decides motion. This single-writer rule is what makes camera behavior globally consistent.

## Remotion Considerations

Implement as a context provider at the composition root exposing the interpolated view matrix per frame; scenes render inside a transformed container. Attention targets are declared data, allowing the full camera plan to be validated (budget, rhythm alternation) before render.

## Future Extension Points

Multi-subject framing grammar (two-subject compositions); reference-derived shot archetypes pending Part V.

## Cross-References

→ §I.1, → §I.2, → §I.5, → §II.6, → §II.11 [Draft]

---

# Chapter II.8 — Awareness Lighting System

## Purpose

This chapter defines lighting as the visible implementation of Awareness. Illumination is the language's highest-salience channel (Perception Model, assumption 5) and therefore its most tightly rationed one.

## Canonical Definition

**Awareness Lighting System** — the lighting model in which scene illumination, contrast, and color temperature encode the current state of perceptual awareness within the narrative.

## Normative Rules

### Awareness States (V, S)

1. Lighting is a state machine with exactly four canonical states:

| State           | Meaning                                   | Key luminance | Contrast ratio | Depth cueing                      |
| --------------- | ----------------------------------------- | ------------- | -------------- | --------------------------------- |
| `L0-blind`      | Pre-perception (abstraction, DOM, code)   | 15–25%        | ≤ 2:1, flat    | None; flat space                  |
| `L1-aware`      | Perception beginning                      | 35–50%        | 3:1–5:1        | Soft directional key              |
| `L2-perceiving` | Active perception                         | 55–75%        | 5:1–8:1        | Full volumetric depth             |
| `L3-lucid`      | Full understanding (Clarity → Conviction) | 80–95%        | 8:1–12:1       | Deep, clean, minimal shadow noise |

2. State transitions are monotonic within a narrative: awareness never regresses after the Discovery event. Pre-Discovery, only `L0 ↔ L1` oscillation is permitted (expressing Tension/Possibility).
3. The `L1 → L2` transition is the **Discovery event** and occurs exactly once (Emotional Arc, rule 4). Duration: `t-monumental`. Easing: `e-shift`.
4. All other state transitions use `t-scenic` and `e-shift`, and begin one Anticipation Lead before their motivating narrative event.
5. Color temperature is bound to state: `L0` is neutral-cold (~5500–6500 K equivalent); temperature warms monotonically with awareness, reaching a restrained warm-neutral (~4500–5000 K) at `L3`. Saturated color grading is prohibited; awareness is expressed through luminance and temperature, not hue shifts.
6. Lighting changes count against the Motion Budget as subordinate motion (0.3) except the Discovery event, which is a primary motion (0.7).

### Prohibitions (V)

7. No flicker, pulse, strobe, lens flare, or animated glow on any element. Glow implies energy; Ocular's light implies awareness.
8. No unmotivated relighting (Brand Physics, Law 2). Every lighting change must be attributable to a narrative awareness change stated in the sequence plan.

## Informative Rationale

**[Informative — P]** Because luminance contrast establishes hierarchy within the first fixation (assumption 5), lighting states are the fastest channel the language possesses; rationing them to four states with one non-repeatable climax preserves their legibility. **[Informative — N]** The monotonicity rule is the narrative spine: the entire Ocular story — blindness to sight — is told by the lighting state machine alone, even with all other channels removed. A launch video whose lighting timeline does not read as that story is misconstructed regardless of its other qualities.

## Dependencies

`implements` → Brand Physics Law 2. `depends_on` → Perception Model assumption 5. `requires` → Temporal Grammar (II.6). `interacts_with` → Focus Field System (II.9) [Draft]: focus may sharpen only subjects at `L1` or above.

## Dependents

Emotional Arc stages Tension, Discovery, Clarity, Conviction.

## Anti-Patterns

- **Awareness regression** — dimming after Discovery for drama. Failure mode: the light code becomes ornamental and the metaphor collapses.
- **Glow inflation** — adding bloom to signify importance. Importance is signified by focus and camera attention, never emissive effects.

## Engineering Abstraction (E)

A composition-scoped `AwarenessTimeline` owns the lighting state per frame: an ordered list of `{ state, eventFrame }`, from which key luminance, contrast, and temperature are derived via the state table and interpolated with `e-shift`. Scenes read lighting values; they never set them. Single-writer, mirroring the Observer Camera rule.

## Remotion Considerations

Lighting resolves to a per-frame set of CSS custom properties (or shader uniforms in 3D scenes): `--key-luminance`, `--contrast-scalar`, `--temp-k`. Provided via context from `AwarenessTimeline`; every scene styles itself from these variables, guaranteeing global consistency at zero per-scene cost.

## Future Extension Points

Interaction with real product-UI screen recordings (how captured UI is graded into awareness states); dark-environment variants for event/keynote screens.

## Cross-References

→ §I.2, → §I.4, → §II.6, → §II.9 [Draft]

---

# Chapter II.9 — Focus Field System [Draft]

**[Normative]** Registered scope: canonical depth-of-field model; focus as Certainty; rack-focus events bound to narrative certainty shifts; blur radius scale bound to Temporal Grammar; interaction rules with Awareness Lighting (`L0` scenes have no focus differentiation — blindness has no certainty).

---

# Chapter II.10 — Reveal Grammar

## Purpose

This chapter defines the closed taxonomy of ways anything may enter an Ocular composition. It exists so that entrances are chosen by narrative meaning rather than invented per scene: every entrance in every Ocular video must be an instance (`is_example_of`) of exactly one canonical reveal class.

## Canonical Definition

**Reveal Grammar** — the closed set of four reveal classes — Emergence, Resolution, Assembly, Disclosure — each binding a visual entrance mechanism to a fixed narrative meaning.

## Normative Rules

1. The four canonical reveal classes:

| Class          | Mechanism (V)                                                                              | Narrative meaning (N)                                         | Timing                    | Easing                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Emergence**  | Subject rises in luminance from the field (opacity/luminance ramp, ≤ 4% positional travel) | Something existed but was unperceived; awareness reaches it   | `t-base` – `t-deliberate` | `e-reveal`                                                                                                          |
| **Resolution** | Subject sharpens from defocus into full focus                                              | Uncertainty becomes certainty                                 | `t-swift` – `t-base`      | `e-shift`                                                                                                           |
| **Assembly**   | Subject composes from constituent parts converging along curved paths                      | Understanding is constructed from pieces                      | `t-deliberate`            | `e-reveal` per part, staggered ≤ 3 parts as one primary motion sharing a velocity field (→ §I.5 rule on formations) |
| **Disclosure** | Camera motion brings an already-present subject into frame                                 | The world is larger than the current view; perception travels | Camera tokens (→ §II.7)   | `e-observe`                                                                                                         |

2. Class selection is determined by narrative meaning, never visual preference. The test: state what the entrance _says_; the table then dictates the class.
3. Reveal classes and awareness states are bound: Emergence requires an active illumination context (`L1+`); Resolution requires the Focus Field System and is prohibited at `L0` (→ §II.9 [Draft]); Disclosure is the only class permitted at `L0`.
4. Spring, bounce, and overshoot entrances are prohibited in all classes. This prohibition derives from Brand Physics Law 7 alone; the deep-pass measurement (§V.3, F4) found the reference itself uses no overshoot, so the rule marks a shared conviction, not a divergence.
5. Exits are the time-reversed conjugates of reveals, using `e-exit`, at one duration class shorter than the entrance. Subjects never exit by the mechanism of a different class than they entered.
6. The Sigil Reveal (→ §I.6) is the canonical brand instance: `is_example_of` Resolution (Catchlight) compounded with Emergence (illumination rise).

## Informative Rationale

**[Informative]** The reference video (Part V) achieves high element turnover using a single mechanism family — scale-pops — which reads as friendly but semantically flat: every entrance means only "here is a new thing." Binding four mechanisms to four meanings lets Ocular's entrances carry story content for free; a viewer who never reads a word still receives "constructed," "clarified," "noticed," or "traveled to."

## Dependencies

`requires` → Temporal Grammar (II.6). `depends_on` → Awareness Lighting System (II.8), Focus Field System (II.9) [Draft], Observer Camera System (II.7). `constrained_by` → Motion Budget Principle (I.5).

## Dependents

Typographic Motion System (II.12), Sequence Architecture (III.14), Sigil Reveal (I.6).

## Anti-Patterns

- **Class blending** — combining mechanisms decoratively (e.g., a subject that fades, sharpens, and assembles). Compounds are permitted only when both meanings are narratively true (the Sigil Reveal is the sanctioned example).
- **Meaning drift** — using Assembly for a subject that is not conceptually composite. Failure mode: the class vocabulary loses semantic value and reverts to decoration.

## Engineering Abstraction (E)

Four components — `Emergence`, `Resolution`, `Assembly`, `Disclosure` — sharing one interface: `{ subject, entryFrame, durationToken }`. Each registers with the `MotionLedger`. `Disclosure` is implemented as an `AttentionTarget` declaration to the `ObserverCamera` rather than a local animation.

## Remotion Considerations

Reveal components wrap children and derive interpolations from tokens; `Assembly` accepts a part manifest with a shared path-field function guaranteeing the single-velocity-field condition is checkable.

## Future Extension Points

Data-driven reveal density limits per Beat (→ §III.14); a fifth class only if Part V analysis of future references identifies a semantically distinct mechanism.

## Cross-References

→ §I.5, → §I.6, → §II.6, → §II.7, → §II.8, → §V.3

---

# Chapter II.11 — Transition Grammar

## Purpose

This chapter defines how compositions move between narrative units. It converts the reference video's most important structural finding — twenty seconds with zero hard cuts — into a canonical system.

## Canonical Definition

**Transition Grammar** — the closed set of three boundary classes — Field Handoff, Attention Traverse, Lucidity Step — governing all movement between narrative Beats (→ §III.14), together with the Persistent Field on which they operate.

## Normative Rules

1. **The Persistent Field** — canonical entity: the continuous background environment that exists for the entire duration of a composition. The Persistent Field is never cut, replaced, or teleported. Its color state is owned exclusively by the `AwarenessTimeline` (Ink↔White axis, → §I.6 Polarity Rule).
2. Hard cuts are prohibited in all formats. (Reference validation: the 20 s reference contains zero scene-detection events at 0.1 threshold; continuity is achievable at even the most compressed duration.)
3. The three canonical boundary classes:

| Class                  | Mechanism (V)                                                                                                                | Narrative meaning (N)                                | Cognition expressed  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------- |
| **Field Handoff**      | Outgoing Beat's elements exit (per §II.10 rule 5); incoming Beat's elements reveal; the Persistent Field persists throughout | The mind moves to the next thought in the same space | Sequential reasoning |
| **Attention Traverse** | The Observer Camera carries the frame from one spatial zone to another; both zones coexist in the world                      | Perception travels; the world is continuous          | Attention shift      |
| **Lucidity Step**      | An awareness-state transition (→ §II.8) is the boundary itself; elements may persist across it                               | Understanding deepens; the same world is seen better | Realization          |

4. Class selection: Field Handoff is the default for `f-social-vertical`; Attention Traverse requires a camera budget and is the default for `f-web-hero`; the Lucidity Step is rationed by the Awareness Lighting monotonicity rules and the Discovery-uniqueness rule.
5. During any boundary, element exit and element entrance overlap per Motion Budget rule 3 (new primary begins only in the old primary's deceleration phase). A frame containing neither outgoing nor incoming subjects (an "empty stage") is prohibited except as a deliberate pre-Discovery hold.
6. Boundaries must complete within `t-deliberate` for Field Handoffs and `t-scenic` for Attention Traverses.

### Loop Closure (S, N)

7. **Loop Closure** — canonical boundary condition for compositions that autoplay on a continuous loop (the `f-web-hero` website placement is the canonical case). A loop-closing composition's final rendered frame must be visually identical to its frame 0, so that the wrap is imperceptible.
8. Loop Closure imposes three joint constraints on the first and last Beats:
   - **Field parity.** The composition must begin and end at the same awareness state. Because awareness is monotonic post-Discovery (§II.8 rule 2) and must end at `L3-lucid` (§I.6 rule 4), a looping composition therefore _opens_ at `L3` as well: it begins in the resolved state and departs from it.
   - **Subject parity.** The element present at frame 0 must be the element present at the final frame, at identical position, scale, and focus. The canonical shared subject is the Conviction frame's wordmark.
   - **Motion parity.** Both bookend Beats must be at rest. Frame 0 and the final frame are stillness frames; no motion may be mid-flight across the wrap.
9. Loop Closure inverts the composition's narrative posture from _arrival_ to _return_: the story becomes a departure from lucidity into the blind state and back, rather than a one-way journey. The Emotional Arc is unchanged in order and content; only the framing shifts, because the viewer who watches twice experiences the ending as the beginning of a re-explanation.
10. Loop Closure is optional and declared per composition (`loop: true` in the SequencePlan). Non-looping compositions (social placements, which autoplay once in-feed) are unaffected and retain the standard `L0/L1 → L3` polarity travel.
11. The Conviction frame doubles as the composition's **poster frame** in looping placements, so the pre-playback still and the resting state are the same asset.

## Informative Rationale

**[Informative — Loop Closure]** Loop Closure exists because the website hero is a _placement_, not a screening: the viewer arrives mid-cycle and leaves mid-cycle, so a composition with a hard wrap advertises its own seam every 20 seconds. Making frame 0 and the final frame the same still resolves this without a crossfade, which would violate the Persistent Field's continuity. The narrative consequence in rule 9 is the interesting one: a looping Ocular hero is not weakened by starting at its own conclusion, because the brand metaphor is cyclical by nature — perception is a state one can lose and regain, and a loop dramatizes exactly that.

**[Informative]** The reference demonstrates why cut-free continuity dominates short-form: with ~2.2 s per Beat (§V.3, F7), there is no time to re-establish context after a cut, so spatial persistence substitutes for narrative connective tissue. Ocular adopts the principle but upgrades the mechanism: the reference already uses in-composition camera moves for some boundaries (§V.3, F5), which Ocular formalizes as the Attention Traverse under Observer Camera rules; and where the reference's field luminance drifts continuously downward (110 → 13, §V.3, F2) as an implicit grade, Ocular's Lucidity Step makes luminance change a discrete, legible state machine (§II.8).

## Dependencies

`requires` → Reveal Grammar (II.10), Observer Camera System (II.7), Awareness Lighting System (II.8), Temporal Grammar (II.6). `constrained_by` → Motion Budget Principle (I.5).

## Dependents

Sequence Architecture (III.14).

## Anti-Patterns

- **Field cut** — swapping the Persistent Field color/texture instantaneously at a boundary. Failure mode: reads as a cut; perception's continuity — the brand's core claim — is broken by its own video.
- **Boundary stacking** — running a Field Handoff and a Lucidity Step simultaneously without narrative cause. Two cognitive events at once exceed comprehension bandwidth (Perception Model, assumption 1).

## Engineering Abstraction (E)

A `BeatBoundary` component orchestrates each class: it schedules outgoing exits, incoming reveals, and (for Traverses) submits the `AttentionTarget`. Boundaries are declared in the sequence plan (→ §III.14), never improvised inside scenes.

## Remotion Considerations

Beats are `Sequence` blocks overlapped by the boundary duration; the Persistent Field is a root-level layer beneath all Beats, styled solely from `AwarenessTimeline` custom properties — making rule 1 structurally unviolable.

## Future Extension Points

Loop-closure boundaries for seamlessly looping social assets (final frame hands off to first frame).

## Cross-References

→ §I.5, → §I.6, → §II.6, → §II.7, → §II.8, → §II.10, → §III.14, → §V.3

---

# Chapter II.12 — Typographic Motion System

## Purpose

This chapter defines type as a motion citizen: what the brand's words look like in time. Typography carries the Recognition and Clarity stages of the Emotional Arc and is, in muted social contexts (Silent-First Principle), the only verbal channel the language possesses.

## Canonical Definition

**Typographic Motion System** — the canonical type scale, the Claim unit, and the rules binding typographic entrances and exits to Reveal Grammar.

## Normative Rules

### Type Canon (V)

1. The canonical typeface is **Poppins** (DDR-011). Canonical weights and roles:

| Role token     | Weight                | Case          | Canonical use           |
| -------------- | --------------------- | ------------- | ----------------------- |
| `type-display` | Poppins Bold (700)    | Sentence case | Claims; one per Beat    |
| `type-support` | Poppins Medium (500)  | Sentence case | Sub-claims, annotations |
| `type-ui`      | Poppins Regular (400) | As-designed   | Idealized UI text       |

2. Type color is Ocular Ink on light-state fields and Ocular White on dark-state fields, switching per the variant rule of §I.6 rule 6. Gray type is permitted only inside Idealized UI.
3. Display sizing for `f-social-vertical`: Claims occupy 70–90% of frame width, maximum three lines, set within the vertical safe area (→ §I.6 rule 12).

### The Claim (N, S)

4. **Claim** — canonical unit: a single typographic message of at most eight words expressing exactly one idea. Each Beat (→ §III.14) contains at most one Claim. Paragraph-length on-screen text is prohibited outside Idealized UI.
5. Claim dwell time: a Claim must remain fully resolved and still for a minimum of `t-deliberate` plus 80 ms per word before its exit may begin. (Reference validation: one message per beat at ~2.2 s mean cadence, §V.3 F7, conforms at typical claim lengths.)

### Motion Rules (V, S)

6. Typographic entrances must be instances of Reveal Grammar classes; permitted classes for type are Emergence and Resolution only. Assembly of type (per-character or per-word construction) is prohibited, with one exception: the Recognition stage of the Emotional Arc may use a single per-word staggered Emergence (maximum one per composition) forming one primary motion, using the **Accelerating Stagger**: per-word intervals decreasing monotonically from `t-swift` (267 ms) to `t-micro` (133 ms). (Reference measurement: 440 → 220 ms accelerating intervals, §V.3 F6; Ocular adopts the accelerating shape on its own token scale.)
7. Type never moves while being read: positional travel during the dwell period is 0. Tracking, weight, and size are not animated properties.
8. Type exits use `e-exit` at `t-swift`, by the conjugate mechanism of the entrance (→ §II.10 rule 5).

## Informative Rationale

**[Informative]** Rule 7 derives from the Perception Model: reading requires stable fixation targets; moving type taxes saccadic correction and reads as haste. The near-total prohibition of per-character animation preserves a scarce resource — when the single sanctioned per-word reveal occurs at Recognition, it is the only time the audience has seen language _behave_, which marks the naming of the problem as an event. The eight-word ceiling is the reference's most transferable lesson: its claims survive muted autoplay precisely because they are glanceable.

## Dependencies

`requires` → Brand Constants (I.6), Reveal Grammar (II.10), Temporal Grammar (II.6). `constrained_by` → Motion Budget Principle (I.5).

## Dependents

Sequence Architecture (III.14): Beat definitions consume the Claim unit.

## Anti-Patterns

- **Kinetic-type showcase** — type sliding, rotating, or masking as decoration. Failure mode: language becomes spectacle; violates rule 7 and the understanding-over-spectacle philosophy.
- **Claim crowding** — two Claims visible simultaneously. Failure mode: comprehension is single-threaded (assumption 1); both claims are half-read.

## Engineering Abstraction (E)

A `Claim` component: `{ text, revealClass, beat }`. It validates the eight-word ceiling at build time, computes dwell from the rule-5 formula, and registers with the `MotionLedger`.

## Remotion Considerations

Poppins loaded via `@remotion/google-fonts` (open license; weights 700/500/400). Dwell computation must use token frames; the per-word Recognition reveal is a single `Sequence` with `t-micro` frame offsets.

## Future Extension Points

Localization rules (Claim length ceilings for other languages); numeric/data typography for Idealized UI analytics.

## Cross-References

→ §I.4, → §I.5, → §I.6, → §II.6, → §II.10, → §III.14

---

---

# PART III — COMPOSITION

### III.13 Scene Composition Rules [Draft]

**[Normative]** Registered scope, enriched by Part V findings: single-column center-stacked composition as the `f-social-vertical` default (reference-validated); spatial grid; safe volumes for the Observer Camera; subject placement relative to camera path curvature; negative-space quotas per Emotional Arc stage; Idealized UI card sizing relative to frame.

---

# Chapter III.14 — Sequence Architecture

## Purpose

This chapter implements the Emotional Arc at the timeline level: how ten stages become a concrete plan of Beats for each Format Canon entry, including the compression rules that the 20-second social format demands.

## Canonical Definition

**Sequence Architecture** — the system by which a composition's timeline is constructed as an ordered series of Beats, each Beat binding one Emotional Arc stage (or merged stage group), at most one Claim, one reveal plan, and one boundary class.

## Normative Rules

### The Beat (S)

1. **Beat** — canonical unit: a contiguous timeline span expressing exactly one narrative idea. A Beat contains: one Arc stage assignment, at most one Claim (→ §II.12), one primary-motion plan conforming to the Motion Budget, and one closing boundary (→ §II.11).
2. Beat duration bounds: minimum `t-scenic` (2.13 s); maximum 2× `t-monumental` (8.53 s). Boundary micro-Beats (a transition treated as its own segment) are not Beats and are governed by §II.11. (Reference validation: measured mean cadence ~2.2 s, §V.3 F7, confirms the lower bound is viable.)

### Stage Compression (S, N)

3. Canonical compression per format:

| Format                                            | Beats | Stage mapping                                                                                                                                                                                                                         |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f-web-hero` (60–90 s)                            | 8–10  | Full ten-stage arc; stages may pair only as Curiosity+Recognition and Scale+Conviction                                                                                                                                                |
| `f-social-square` / `f-social-vertical` (20–30 s) | 5     | B1 Hook = Recognition+Curiosity (inverted, see rule 4) · B2 Tension+Possibility · B3 Discovery (contains the Discovery event) · B4 Empowerment+Confidence · B5 Clarity+Scale+Conviction (ends in the Conviction frame, → §I.6 rule 4) |

4. **The Inversion Rule.** In formats ≤ 30 s, Recognition precedes Curiosity: the composition cold-opens on the **Product Atom** — the smallest recognizable unit of Ocular's value, already working — within the first second, before any establishing material. (Reference-derived principle: cold audiences grant no setup time; the reference opens on its chat widget mid-function at t < 1 s.) In long-form, the canonical order of §I.4 holds.
5. The Discovery event's placement: at 45–55% of total duration in all formats. Post-Discovery time is never less than 40% of the composition (understanding must be _enjoyed_, not just reached).
6. The final Beat always terminates in ≥ 2 s of Conviction-frame stillness. (Reference measurement: 1.62 s terminal hold, §V.3 F3; Ocular's minimum is deliberately longer — the Conviction frame is the composition's thesis and is granted more time than the reference grants its CTA.)

### Rhythm at Timeline Scale (S)

7. Consecutive Beat durations obey the alternation rule of Temporal Grammar rule 8 applied at Beat scale: no three consecutive Beats of equal duration class.
8. Boundary-class sequencing: an Attention Traverse may not directly follow an Attention Traverse (perpetual travel reads as tourism, → §II.7 anti-patterns); the Lucidity Step occupies exactly one boundary per composition pre-`L2` (the Discovery boundary) plus at most one `L2→L3` step.
9. **The Material Specification
   depends_on → Brand Constants, Awareness Lighting System
   constrains → all rendering
   Remotion Component Specification
   implements → Temporal Grammar, Material Specification, all Part II-III systems
   defines → Single-Writer Rule, Data-Authoring Rule
   Decrescendo Principle** — canonical rule: from the Discovery Beat onward, per-Beat motion spend (Motion Budget totals integrated over the Beat) must be monotonically non-increasing, and inter-motion hold durations must be monotonically non-decreasing, terminating in the composition's longest stillness (rule 6). Measured foundation: the reference's motion energy collapses after 12.56 s into a near-still final 35%, and all of its stillness holds occur in that zone (§V.3, F3); resolution is expressed as the subtraction of motion. The decrescendo is the macro-rhythm of every Ocular composition; local crescendos (e.g., the Accelerating Stagger) are permitted only nested inside it.

## Informative Rationale

**[Informative]** Rule 5 is the structural answer to the reference's one weakness relative to Ocular's philosophy: the reference spends roughly two-thirds of its duration in feature enumeration before its message zone begins (§V.3, F3). An awareness narrative needs its hinge in the middle, because the second half — the world as seen _with_ Ocular — is the product demonstration. The Inversion Rule, by contrast, is the reference's most valuable teaching adopted nearly whole: in muted, swipeable contexts, the first second must show the product being itself.

## Dependencies

`implements` → Emotional Arc (I.4). `requires` → Transition Grammar (II.11), Reveal Grammar (II.10), Typographic Motion System (II.12), Format Canon (I.6), Temporal Grammar (II.6). `constrained_by` → Motion Budget Principle (I.5).

## Dependents

All future launch-video sequence plans `is_example_of` this architecture.

## Anti-Patterns

- **Feature parade** — a sequence of Empowerment Beats with no Discovery hinge. Failure mode: the reference's structure reproduced; enumeration without transformation.
- **Late climax** — Discovery placed past 60%. Failure mode: no time to demonstrate the perceiving state; the video argues but never shows.

## Engineering Abstraction (E)

A `SequencePlan` data structure — the single input from which a composition renders: ordered Beats `{ stage, durationToken, claim?, revealPlan, boundaryClass, attentionTarget?, awarenessEvent? }`. All validation (budget, rhythm alternation, Discovery placement, boundary sequencing) runs on the plan before any rendering.

## Remotion Considerations

`SequencePlan` maps 1:1 to overlapped `Sequence` blocks (overlap = boundary duration). Because the plan is data, all three Format Canon compositions can be generated from one narrative source with format-specific plans, sharing scenes.

## Future Extension Points

A 10–15 s "teaser" compression (3 Beats); looping social variants (→ §II.11 extension).

## Cross-References

→ §I.4, → §I.5, → §I.6, → §II.6, → §II.10, → §II.11, → §II.12, → §V.3

---

---

# PART IV — ENGINEERING

---

# Chapter IV.15 — Material and Render Specification

## Purpose

Parts I–III specify how things behave. This chapter specifies what they are made of. It exists because behavioral specification alone fails the Determinism Test at the visual layer: two engineers implementing identical timing can still produce unrecognizably different images. Part V rejected the reference's emissive/accent-colour approach to salience; this chapter defines what replaces it.

## Canonical Definition

**Material Specification** — the canonical rendering properties of the Persistent Field, Idealized UI surfaces, the Gaze Ring, and typography at each awareness state.

## Normative Rules

### The Neutral Scale (V)

1. All non-brand surfaces derive from a fixed nine-step scale interpolated in **OKLCH** (perceptually uniform; prevents the muddy midtones of sRGB interpolation) between Ocular Ink and Ocular White, with a slight chroma retention so greys carry the brand's blue-ink cast rather than going neutral-dead:

| Token   | Hex       | Canonical use                            |
| ------- | --------- | ---------------------------------------- |
| `n-000` | `#0B0F17` | Ocular Ink — L0/L1 field; type on light  |
| `n-100` | `#151A24` | Raised surface on dark field             |
| `n-200` | `#222836` | UI card fill (dark states)               |
| `n-300` | `#39404F` | Borders, dividers (dark states)          |
| `n-400` | `#5A6272` | Disabled / de-emphasised content         |
| `n-500` | `#848B99` | Secondary text on dark; borders on light |
| `n-600` | `#AFB5C0` | Tertiary surfaces on light               |
| `n-700` | `#D7DAE0` | UI card fill (light states)              |
| `n-800` | `#EEF0F3` | Raised surface on light field            |
| `n-900` | `#FFFFFF` | Ocular White — L3 field; type on dark    |

2. No colour outside this scale and the two brand constants may appear in any composition, with one exception: Idealized UI may render third-party logos in their own colours when depicting integrations, at ≤ 4% of frame area, never during Discovery or Conviction.

### The Persistent Field (V)

3. The field is a single flat colour interpolated along the neutral scale by awareness state — `L0`→`n-000`, `L1`→`n-000`, `L2`→`n-100` with directional key, `L3`→`n-900`. It carries no gradient, texture, noise, vignette, or pattern. Depth is created by object separation and shadow, never by background decoration.
4. Field colour transitions are owned solely by `AwarenessTimeline` and interpolate in OKLCH.

### Depth and Light (V)

5. Depth is expressed by exactly three means, in this order of preference: parallax offset between layers, contact shadow, and scale-with-distance. Blur-as-depth is reserved for the Focus Field System (→ §II.9 [Draft]) and never used decoratively.
6. Shadows are single-source, soft, and directional, matching the awareness state's key direction. Canonical shadow at `L2`: y-offset 4% of subject height, blur 8% of subject height, opacity 0.18 at `n-000`. Shadows scale with awareness: absent at `L0` (flat space), full at `L2`–`L3`.
7. Corner radius scale for all UI surfaces: 8 / 16 / 24 px at 1080-width reference, scaled proportionally by format. The Logomark and Gaze Ring are perfect circles and exempt.

### Gaze Ring Material (V)

8. Stroke weight equals the Logomark's ring-thickness ratio (ring thickness ÷ outer diameter) applied to the Gaze Ring's diameter. Default diameter: 5.5% of frame width. Colour: `n-900` on dark fields, `n-000` on light fields. No fill, no glow, no trail, no drop shadow. The Catchlight sits at 40° clockwise from vertical and is a filled lens region, not a separate stroked circle.

### Typography Rendering (V)

9. Poppins Bold (700) for `type-display`, Medium (500) for `type-support`, Regular (400) for `type-ui`. Optical sizes at 1080-width reference: display 72–96 px, support 40–48 px, UI 24–32 px. Line-height 1.15 display, 1.35 otherwise. Tracking: −1.5% display, 0 otherwise.
10. Type never carries shadow, stroke, gradient, or glow. It sits at full opacity or it is absent; partial-opacity type is prohibited outside the opacity ramp of an active Emergence reveal.

## Informative Rationale

**[Informative]** The nine-step scale exists so that "grey" is never a judgement call. OKLCH interpolation is specified because the Ink→White polarity arc is the composition's spine: interpolating it in sRGB produces a visible desaturated sag through the midpoint, which would make the Discovery event — the language's most important moment — look washed rather than illuminating. Rule 3's flatness prohibition is the direct structural replacement for the reference's glowing gradient fields: Ocular earns depth through objects and light, so the field must contribute nothing that competes.

## Dependencies

`depends_on` → Brand Constants (I.6), Awareness Lighting System (II.8). `constrains` → all rendering.

## Dependents

Motion Token System (IV.16) ships these values; every component consumes them.

## Anti-Patterns

- **Field decoration** — gradients, meshes, or noise in the Persistent Field. Failure mode: reintroduces the reference's salience model through the back door.
- **Ad-hoc grey** — a hex value not on the neutral scale. Failure mode: the scale stops being a contract and the Determinism Test fails at the pixel level.
- **Texture stacking** — grain, dot-grid, scanline, or vignette overlays on surfaces or field. Failure mode: texture is ambient motion's visual equivalent and consumes attention budget without carrying information; it is the most common way a composition reads as "busy but unrefined."
- **Glitch and chromatic aberration** — RGB split, datamosh, or scanline tearing to signify failure or blockage. Failure mode: glitch codes _malfunction_, but the Ocular narrative's negative state is _blindness_ — an absence, not an error. Depicting it as malfunction reframes the product as a bug fix rather than a missing sense, contradicting the Central Brand Metaphor.
- **Emissive celebration** — particle bursts, confetti, sparkle, or glow flashes on success or connection events. Violates §I.6 rule 15 (Success and State Grammar) and §II.8 rule 7.

## Cross-References

→ §I.6, → §II.8, → §II.9 [Draft], → §IV.16

---

# Chapter IV.16 — Remotion Component Specification

## Purpose

This chapter specifies the component architecture that renders the canon. It defines module boundaries, interfaces, ownership, and validation so that implementation is a transcription task rather than an interpretation task.

## Canonical Definition

**Remotion Component Specification** — the canonical module graph, component interfaces, and validation contracts through which the Motion Design Bible becomes executable.

## Normative Rules

### Module Graph (E)

1. Canonical structure. Dependencies flow downward only; no module imports from a layer above it.

```
tokens/          temporal.ts · brand.ts · material.ts · formats.ts   (pure data)
   ↓
systems/         AwarenessTimeline · ObserverCamera · MotionLedger · FocusField
   ↓
primitives/      Emergence · Resolution · Assembly · Disclosure
                 Claim · GazeRing · SigilReveal · BeatBoundary
   ↓
compositions/    Beat · SequenceRenderer · <Format>Composition
   ↓
plans/           *.plan.ts   (SequencePlan data — the only per-project authoring surface)
```

2. **The Single-Writer Rule.** Exactly one module owns each global channel: `AwarenessTimeline` owns lighting and field colour; `ObserverCamera` owns the view transform; `MotionLedger` owns budget validation. No primitive or scene may write these channels directly.
3. **The Data-Authoring Rule.** A new launch video is authored by writing a `SequencePlan` and, if needed, new scene content — never by editing systems or primitives. If a project requires a systems change, that is a canon question and requires a DDR.

### Token Modules (E)

4. `temporal.ts` exports duration tokens as frames-at-30fps, easing tokens as `Easing.bezier` arguments, `ANTICIPATION_LEAD_FRAMES = 6`, and helpers that accept only tokens:

```ts
export const T = {
  micro: 4,
  swift: 8,
  base: 16,
  deliberate: 32,
  scenic: 64,
  monumental: 128,
} as const;
export const E = {
  observe: [0.3, 0.0, 0.1, 1.0],
  reveal: [0.2, 0.0, 0.0, 1.0],
  exit: [0.6, 0.0, 0.9, 1.0],
  drift: [0.4, 0.0, 0.6, 1.0],
  shift: [0.45, 0.0, 0.15, 1.0],
} as const;
export type DurationToken = keyof typeof T;
export const tokenInterpolate = (
  frame: number,
  start: number,
  duration: DurationToken,
  from: number,
  to: number,
  ease: keyof typeof E,
) => number; // the ONLY sanctioned interpolation entry point
```

5. `brand.ts` exports `INK`, `WHITE`, the neutral scale `N[0..900]`, Logomark/Gaze-Ring geometry constants (`RING_THICKNESS_RATIO`, `CATCHLIGHT_ANGLE_DEG = 40`), and type role definitions. `material.ts` exports shadow, radius, and depth constants (→ §IV.15). `formats.ts` exports the Format Canon with safe-area insets.

### System Components (E)

6. **`AwarenessTimeline`** — context provider at composition root.

```ts
type AwarenessEvent = { state: 'L0' | 'L1' | 'L2' | 'L3'; atFrame: number };
type AwarenessValue = {
  state: string;
  keyLuminance: number;
  contrastRatio: number;
  tempK: number;
  fieldColor: string;
  shadowOpacity: number;
};
```

Derives per-frame values from the §II.8 state table, interpolating in OKLCH with `E.shift` over `t-scenic` (or `t-monumental` for the Discovery event), applying the Anticipation Lead automatically. Publishes CSS custom properties `--field`, `--key-lum`, `--contrast`, `--shadow-op` at root. Validates monotonicity and Discovery-uniqueness at build time.

7. **`ObserverCamera`** — context provider owning the view transform.

```ts
type AttentionTarget = {
  subject: string;
  arrivalFrame: number;
  framing: { x: number; y: number; scale: number };
  move: 'dolly' | 'truck' | 'pedestal' | 'pan' | 'tilt';
};
```

Derives Anticipate onset as `arrivalFrame − T[attendDuration] − ANTICIPATION_LEAD_FRAMES`, builds a single-arc spline path (lateral deviation ≤ 8%), applies `E.observe`, and enforces the Confirm settle plus its trailing stillness. Rejects at build time: angular velocity above the pursuit ceiling, rotation outside limits, and any target whose Anticipate window overlaps a prior move's Attend phase.

8. **`MotionLedger`** — validation layer, not a renderer. Every animated element registers `{ class:'primary'|'subordinate'|'ambient', startFrame, endFrame }`. Computes per-frame spend against the §I.5 costs; throws in development on: budget > 1.0, a new primary starting before the previous primary's final 30%, more than two ambients, and spend > 0.1 during Clarity/Conviction Beats.

### Primitive Components (E)

9. All four reveal classes share one interface, so class is swappable without refactor:

```ts
type RevealProps = {
  entryFrame: number;
  duration: DurationToken;
  children: React.ReactNode;
};
// <Emergence>  luminance/opacity ramp, ≤4% travel, E.reveal
// <Resolution> blur→sharp via FocusField, E.shift
// <Assembly>   parts:Part[] sharing one velocity field, ≤3 parts, E.reveal
// <Disclosure> submits an AttentionTarget; renders no local animation
```

10. **`<Claim>`** — `{ text, reveal:'Emergence'|'Resolution', stagger?:'accelerating' }`. Validates the eight-word ceiling and three-line maximum at build time; computes dwell as `T.deliberate + words × 2.4 frames`; enforces zero positional travel during dwell; renders per §IV.15 rules 9–10. The `accelerating` stagger emits per-word offsets descending `T.swift → T.micro` and is permitted once per composition, at Recognition only.

11. **`<GazeRing>`** — `{ path:Point[], arrivalFrame, action?:'click'|'read'|'fill' }`. Renders per §IV.15 rule 8 from `brand.ts` geometry; traverses via the Attention Cycle; refuses to render when awareness is `L0` (rule 13 of §I.6 is enforced in code, not documentation); asserts singleton per composition.

12. **`<SigilReveal>`** — `{ atFrame, polarity:'dark'|'light' }`. Implements §I.6 rule 7 contrast-relatively: reads the current field from `AwarenessTimeline`, selects the mark variant, runs Catchlight `Resolution` then wordmark `Emergence`, and enforces the trailing `t-deliberate` stillness.

13. **`<BeatBoundary>`** — `{ class:'FieldHandoff'|'AttentionTraverse'|'LucidityStep', overlapFrames }`. Schedules outgoing exits and incoming reveals with the overlap rule, submits the `AttentionTarget` for Traverses, and triggers the `AwarenessEvent` for Lucidity Steps. Asserts no empty-stage frame.

### Composition Layer (E)

14. **`<SequenceRenderer plan={SequencePlan}>`** is the only composition entry point. It validates the entire plan before rendering — budget, rhythm alternation, Discovery placement (45–55%), boundary sequencing, decrescendo monotonicity, terminal stillness ≥ 2 s — and fails the build with the violated rule's canon reference (e.g. `"III.14 rule 9: Beat B4 spend 0.8 > B3 spend 0.7"`). When `plan.loop === true`, it additionally asserts Loop Closure (§II.11 rules 7–11): awareness-state parity between the first and last Beat, subject parity, and zero motion spend on both the first and final frame. Loop parity is verified by rendering frame 0 and the final frame and comparing them; a non-identical pair fails the build. All three Format Canon compositions consume format-specific plans over shared scene content.

## Informative Rationale

**[Informative]** The architecture's central idea is that the canon's normative rules become **build-time assertions rather than review-time opinions**. Every rule expressed as a validator is a rule that cannot silently erode across projects, which is the failure mode the entire governance layer exists to prevent. The Single-Writer Rule is what makes global consistency free: because no scene can touch lighting or camera, a scene authored today and one authored in a year are guaranteed to obey the same physics. The Data-Authoring Rule is the Determinism Test made operational — if a new video requires only a new plan file, then the systems, not the author, are producing the motion language.

## Dependencies

`implements` → Temporal Grammar (II.6), Material Specification (IV.15), and every Part II–III system. `requires` → Brand Constants (I.6).

## Dependents

All future implementations.

## Anti-Patterns

- **Raw interpolation** — calling Remotion's `interpolate` with literal frame numbers instead of `tokenInterpolate`. Failure mode: token drift (→ §II.6 anti-patterns) with no build-time signal.
- **Scene-level lighting or camera** — a scene styling its own background or transform. Violates the Single-Writer Rule; global consistency degrades silently, one scene at a time.
- **Plan bypass** — rendering Beats directly rather than through `SequenceRenderer`. Failure mode: all plan-level validations are skipped, which is where most canon rules live.

### Repository Placement and Delivery (E)

15. The motion system is a **separate package from the consuming application**. Canonical placement in a monorepo: `packages/motion/`, with its own `package.json`, sibling to the website package. The application never imports from the motion package and never carries the render toolchain; the only artifact crossing the boundary is rendered video.
16. Renders output to the application's static asset directory. Canonical delivery set per composition: H.264 MP4 and WebM (browser fallback coverage), plus a PNG poster frame extracted from the Conviction frame (§II.11 rule 11).
17. Web placements are `muted autoplay playsInline` with `loop` where the plan declares it. Because the Persistent Field is flat colour with no gradient, noise, or grain (§IV.15 rule 3), compositions compress unusually efficiently; a 20 s 1080p hero exceeding ~4 MB indicates a §IV.15 violation somewhere in the composition and should be investigated as a canon breach rather than accepted as an encoding cost.
18. All Format Canon variants render from the same scene content in a single pass, driven by format-specific plans (§III.14). Producing a social cut by cropping a hero render is prohibited (→ §I.6 anti-pattern: landscape-first authoring).

## Future Extension Points

A `validate` CLI producing a compliance report per plan; a plan authoring schema (JSON Schema or Zod) for non-engineer authors; automated visual regression against the Conviction frame.

## Cross-References

→ §I.5, → §I.6, → §II.6, → §II.7, → §II.8, → §II.10, → §II.11, → §II.12, → §III.14, → §IV.15

---

---

# PART V — REFERENCE DECONSTRUCTION [Partially Blocked]

## V.1 Reference Registration

**[Informative]** The selected reference is registered as:

- **Title:** "Product Launch Video for AI/SaaS – Doks.ai"
- **Producer:** Zelios (animated video production agency); client Doks.ai (AI chatbot builder)
- **Published:** October 2025 · **Duration:** 20 seconds · **Format:** 9:16 vertical (YouTube Shorts)
- **Stated purpose:** short ad for a cold-audience marketing campaign

Two structural facts already inform the canon: the reference is _short-form vertical_, which motivated making `f-social-vertical` the authoring-default format (→ §I.6 rule 12), and it is a _cold-lead ad_, meaning its narrative must achieve Recognition extremely early — a property Sequence Architecture's 20-second compression rules must preserve.

**Framing device.** The distributed file is a portfolio presentation: the composition is shown playing inside After Effects on a physically filmed desk setup (warm practical lighting, agency mousepad). The desk-and-application wrapper is Zelios's portfolio framing, not part of the client video's design, and is excluded from all analysis. All measurements in §V.3 were taken on a crop of the composition viewport only.

## V.2 Deconstruction Protocol

**[Normative]** Frame-level deconstruction requires frame access. The protocol:

1. The reference video file (or exported frames) is provided into the project workspace.
2. Frames are extracted at 10 fps minimum and analyzed against the Five-Layer Documentation Model.
3. Observed techniques are lifted through the abstraction ladder (Observation → Pattern → Principle → System → Primitive) before any canon entry. Scene-level reproductions are prohibited from entering the canon.
4. Outputs feed exactly three Draft chapters: Reveal Grammar (II.10), Transition Grammar (II.11), Sequence Architecture (III.14). Any finding that would alter Part I foundations requires a DDR.

Until step 1 occurs, Parts II.10, II.11, and III.14 may be drafted from first principles and later _validated_ — not replaced — by reference findings.

## V.3 Deconstruction Findings (Deep Pass)

**[Informative]** Second-generation analysis at native frame rate: all 995 frames (50 fps, 19.97 s), measured on a validated crop of the composition viewport (excluding the portfolio wrapper, → §V.1). Instruments: per-frame mean luminance, frame-difference motion energy, dense optical flow (magnitude and radial divergence for zoom detection), settle-curve fitting on element entrances, and burst detection for stagger timing. This section supersedes the 0.3.0 findings, which sampled at 5 fps and measured the wrapper rather than the composition (DDR-015).

### Corrected narrative map

The composition is dark-themed throughout: a deep near-black field with a luminous teal-green accent system and white/light UI cards. Content sequence: docs-site hero ("Doks.ai — AI chatbot") with a search bar → suggestion cards assemble ("Doks AI Bot," "AI Support Assistant") → push-in to the **Ask AI** search control → a typed question ("How can I implement Doks.ai in Next.js?") → the bot's answer card with numbered install steps and an npm command → two embed-style demonstrations ("Inline Style," "Message Style") on device mockups → "Connect any source / Easily bring your data" with an integrations grid (GitHub, Notion, Zendesk, WordPress, XML, more) → a star-glyph transition → the tagline built word-by-word ("The future of your business ✦ is here," then "with ✦ Doks.ai") → end card (logo + "Get started" CTA).

### Measured findings

**F1 — Continuity (confirmed).** Zero hard cuts across 995 frames (scene detection empty at 0.1 threshold). All boundaries are element turnover and in-composition camera moves on one persistent, continuously evolving field.

**F2 — Luminance arc: a descent.** In-composition mean luma peaks at 110/255 at 1.5 s (white suggestion cards), then declines monotonically through the demonstration — 89 (2.5 s), 57 (3.5 s), 47 (5.5 s), 42 (7 s), 21 (9.5 s) — reaching its minimum of 13 during the tagline (13–17 s), then stepping up ~70% relative (13 → 22) for the end card. The video _darkens as it abstracts_: brightness accompanies concrete UI density; darkness accompanies message and brand. This is the inverse polarity of Ocular's Ink→White arc.

**F3 — Motion decrescendo.** Motion energy is front-loaded (sustained highs across 0–2.5 s; recurring peaks through 12.6 s) and then collapses: after 12.56 s there are no further high-energy events. The final ~7 s (35% of duration) is a near-still message-and-resolution zone. The only stillness holds ≥ 0.3 s all occur in this zone (15.46 s, 16.84 s, and the terminal hold beginning 18.26 s, lasting 1.62 s to picture end). The composition is a single long decrescendo.

**F4 — Entrance easing: fast attack, massive decay, no overshoot.** Settle-curve analysis of three clean entrances (question card 5.3 s, icon rows 10.5 s, logo emergence 17.2 s) shows monotonic approach with **0.0% measured overshoot** in all cases, and extreme deceleration asymmetry: entrances spend 78–95% of their duration below 50% of peak velocity (question card: 50% of progress in 0.16 s, the remaining 40% over 0.60 s). The 0.3.0 characterization "scale-pops with overshoot" was a sampling artifact and is retracted (DDR-015). The reference's entrance physics is in fact _more_ deceleration-asymmetric than Temporal Grammar's ≥ 60% invariant (§II.6 rule 7), which it therefore empirically supports.

**F5 — Camera-move profiles.** In-composition moves measured via optical flow: the push-in to the Ask AI control (0.70 s) has a symmetric velocity profile (peak at 49% of duration — ease-in-out); two later transport moves peak at 17–20% of duration with 84–86% of time below half peak velocity (fast attack, long settle). Radial-divergence analysis shows recurring convergence gestures (elements gathering to center) at 1.0–1.5 s, 7.5 s, 8.5 s, and through the integrations sequence.

**F6 — Accelerating word stagger.** The tagline builds word-by-word with measured intervals of 0.44 → 0.30 → 0.26 → 0.22 s — a monotonically _accelerating_ cadence that creates building momentum toward the claim's completion — followed by a 1.16 s hold, then a two-event swap ("with ✦ Doks.ai") at 0.26 s spacing.

**F7 — Beat cadence.** Motion-energy valley segmentation yields ~9 narrative segments with a mean of ~2.2 s, minimum ~0.8 s (the star-glyph micro-transition), maximum ~3.7 s (the tagline). One message is on screen per beat throughout.

**F8 — Hierarchy mechanism.** Salience is carried by a single luminous teal-green accent system (glowing key elements) plus white-on-dark contrast; the field stays dark so lit elements own attention.

### Layer Two/Three — Psychological and Narrative (interpreted)

The decrescendo (F3) is the video's real emotional engine: density and brightness spend the first two-thirds proving the product, and the withdrawal of both is what makes the closing message feel conclusive — resolution is expressed as _subtraction_. The persistent dark field (F1, F8) lets every lit element own attention without competition. The accelerating stagger (F6) converts a static sentence into a small crescendo nested inside the macro decrescendo. Recognition is achieved in the first second by opening on the product's hero claim and live search UI (cold-audience inversion).

### Layer Four/Five — Lifted Systems and Dispositions

| Measured finding                                                        | Lifted principle                                                                            | Disposition             | Canon destination                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| F1: zero cuts; persistent evolving field                                | Spatial continuity substitutes for connective tissue at short durations                     | **Adopted, upgraded**   | Persistent Field; Field Handoff (§II.11) |
| F3: motion decrescendo; holds lengthen toward end; terminal hold 1.62 s | Resolution is expressed by subtraction of motion; stillness quantity encodes conclusiveness | **Adopted, formalized** | Material Specification                   |

    depends_on → Brand Constants, Awareness Lighting System
    constrains → all rendering

Remotion Component Specification
implements → Temporal Grammar, Material Specification, all Part II-III systems
defines → Single-Writer Rule, Data-Authoring Rule
Decrescendo Principle (§III.14 rule 9); §III.14 rule 6 sets a longer ≥ 2 s minimum |
| F4: fast-attack / long-decay entrances, 0% overshoot, 78–95% below half peak velocity | Deceleration asymmetry is the physical signature of deliberateness | **Adopted (empirical support)** | Temporal Grammar rule 7 (≥ 60% invariant, measured headroom confirmed) |
| F6: accelerating word stagger 440 → 220 ms | Accelerating cadence builds momentum inside a single typographic reveal | **Adopted, tokenized** | Accelerating Stagger, §II.12 rule 6 (`t-swift` → `t-micro`) |
| F7: ~2.2 s mean beat; one message per beat | Beat as narrative quantum; glanceable claims | **Adopted, formalized** | Beat (§III.14); Claim (§II.12) |
| Cold open on hero claim + live UI < 1 s | Recognition precedes Curiosity for cold audiences | **Adopted** | Inversion Rule; Product Atom (§III.14) |
| F5: symmetric ease for attention push-in; asymmetric for transports | Move shape can encode move meaning | **Adapted** | Ocular uses `e-observe` uniformly (Observer character consistency); noted as extension candidate for §II.7 |
| F2: light→dark arc; darkness accompanies abstraction; terminal +70% relative step | Scarcity of light concentrates attention; a terminal luminance step marks resolution | **Adapted, inverted** | Ocular's Ink→White Polarity (§I.6) inverts the direction for metaphor reasons; the flagged risk — bright fields read busier — is absorbed by the Clarity/Conviction budget cap (§I.5 rule 5) and the minimal Conviction frame (§I.6 rule 4) |
| F8: hierarchy via glowing accent color on dark | Hue/emissive salience | **Rejected** | Contradicts the two-color canon and the glow prohibition (§I.6 rule 3, §II.8 rule 7); Ocular's salience channels are luminance state, focus, and camera attention |
| Dense parallel entrances in the 0–2.5 s intro (sustained multi-element motion) | Density signals feature richness | **Rejected** | Violates Motion Budget Principle; richness is expressed sequentially |

**[Normative]** The dispositions above are canonical. The 0.3.0 disposition "scale-pop entrances with overshoot — Rejected" is superseded: the pattern does not exist in the reference (F4). The prohibition of springs, bounces, and elastic easing remains in force, but it derives solely from Brand Physics Law 7, not from reference observation (DDR-015).

---

# APPENDIX A — ONTOLOGY REGISTRY

**[Living]** Canonical entities, one preferred name each.

| Entity                                                                                                    | Defined in   | Type                          |
| --------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------- |
| Central Brand Metaphor                                                                                    | I.1          | Root concept                  |
| Brand Physics                                                                                             | I.2          | Law set                       |
| Observer Law / Illumination Law / Inevitability Law / Stillness Law / Depth Law / Focus Law / Gravity Law | I.2          | Laws                          |
| Perception Model                                                                                          | I.3          | Foundation                    |
| Anticipation Lead                                                                                         | I.3 / II.6   | Canonical parameter (200 ms)  |
| Emotional Arc                                                                                             | I.4          | Narrative structure           |
| Discovery event                                                                                           | I.4 / II.8   | Unique narrative event        |
| Motion Budget Principle                                                                                   | I.5          | Constraint                    |
| MotionLedger                                                                                              | I.5          | Engineering responsibility    |
| Brand Constants                                                                                           | I.6          | Constant set                  |
| Ocular Ink (`#0B0F17`) / Ocular White (`#FFFFFF`)                                                         | I.6          | Color canon                   |
| Polarity Rule                                                                                             | I.6          | Binding rule                  |
| Logomark / Catchlight / Wordmark                                                                          | I.6          | Logo components               |
| Sigil Reveal                                                                                              | I.6          | Canonical logo entrance       |
| Gaze Ring                                                                                                 | I.6          | Idealized UI entity           |
| Success and State Grammar                                                                                 | I.6          | State-change rules            |
| Format Canon (`f-social-vertical`, `f-social-square`, `f-web-hero`)                                       | I.6          | Output formats                |
| Silent-First Principle                                                                                    | I.6          | Audio policy                  |
| Idealized UI Rule                                                                                         | I.6          | Product representation policy |
| Temporal Grammar                                                                                          | II.6         | Token system                  |
| Duration tokens (`t-micro` … `t-monumental`)                                                              | II.6         | Parameters                    |
| Easing tokens (`e-observe`, `e-reveal`, `e-exit`, `e-drift`, `e-shift`)                                   | II.6         | Parameters                    |
| Observer Camera System                                                                                    | II.7         | Primitive                     |
| Attention Cycle (Anticipate / Attend / Confirm)                                                           | II.7         | Behavioral pattern            |
| AttentionTarget                                                                                           | II.7         | Engineering interface         |
| Awareness Lighting System                                                                                 | II.8         | Primitive                     |
| Awareness states (`L0-blind` … `L3-lucid`)                                                                | II.8         | State machine                 |
| AwarenessTimeline                                                                                         | II.8         | Engineering responsibility    |
| Focus Field System                                                                                        | II.9 [Draft] | Primitive                     |
| Reveal Grammar                                                                                            | II.10        | Taxonomy                      |
| Reveal classes: Emergence / Resolution / Assembly / Disclosure                                            | II.10        | Reveal classes                |
| Transition Grammar                                                                                        | II.11        | Taxonomy                      |
| Persistent Field                                                                                          | II.11        | Canonical environment         |
| Boundary classes: Field Handoff / Attention Traverse / Lucidity Step                                      | II.11        | Boundary classes              |
| Loop Closure                                                                                              | II.11        | Boundary condition            |
| Typographic Motion System                                                                                 | II.12        | Primitive                     |
| Type roles (`type-display`, `type-support`, `type-ui`) — Poppins 700/500/400                              | II.12        | Type canon                    |
| Claim                                                                                                     | II.12        | Typographic unit              |
| Sequence Architecture                                                                                     | III.14       | Composition system            |
| Beat                                                                                                      | III.14       | Timeline unit                 |
| Material Specification                                                                                    |

    depends_on → Brand Constants, Awareness Lighting System
    constrains → all rendering

Remotion Component Specification
implements → Temporal Grammar, Material Specification, all Part II-III systems
defines → Single-Writer Rule, Data-Authoring Rule
Decrescendo Principle | III.14 | Macro-rhythm rule |
| Accelerating Stagger | II.12 | Typographic cadence |
| Product Atom | III.14 | Narrative unit |
| Inversion Rule | III.14 | Compression rule |
| SequencePlan / BeatBoundary | III.14 / II.11 | Engineering interfaces |
| Material Specification | IV.15 | Render canon |
| Neutral Scale (`n-000`…`n-900`) | IV.15 | Colour tokens |
| Remotion Component Specification | IV.16 | Engineering system |
| Single-Writer Rule / Data-Authoring Rule | IV.16 | Architecture rules |
| SequenceRenderer / tokenInterpolate | IV.16 | Engineering interfaces |

---

# APPENDIX B — RELATIONSHIP MAP

**[Living]** Expressed exclusively in the canonical relationship vocabulary (§0.3).

```text
Central Brand Metaphor
    defines → Perception, Awareness, Understanding, Cognition, Attention, Comprehension, Certainty

Brand Physics
    depends_on → Central Brand Metaphor
Perception Model
    supports → Brand Physics

Motion Budget Principle
    extends → Stillness Law
    depends_on → Perception Model
    constrains → Observer Camera System, Awareness Lighting System,
                 Focus Field System, Reveal Grammar, Typographic Motion System

Temporal Grammar
    depends_on → Perception Model, Inevitability Law, Gravity Law

Observer Camera System
    implements → Observer Law
    implements → Perception
    requires → Temporal Grammar
    depends_on → Perception Model

Awareness Lighting System
    implements → Illumination Law
    implements → Awareness
    requires → Temporal Grammar
    depends_on → Perception Model
    interacts_with → Focus Field System

Focus Field System [Draft]
    implements → Focus Law
    implements → Certainty

Reveal Grammar [Draft]
    depends_on → Observer Camera System, Awareness Lighting System, Focus Field System

Transition Grammar [Draft]
    implements → Cognition

Typographic Motion System [Draft]
    depends_on → Reveal Grammar

Emotional Arc
    depends_on → Central Brand Metaphor, Brand Physics
    requires → all Part II primitives
Sequence Architecture [Draft]
    implements → Emotional Arc

Motion Token System [Draft]
    implements → Temporal Grammar

Brand Constants
    depends_on → Central Brand Metaphor, Temporal Grammar, Awareness Lighting System
Polarity Rule
    extends → Awareness Lighting System
    implements → Central Brand Metaphor
Gaze Ring
    extends → Logomark (geometry)
    implements → Perception (within Idealized UI)
    depends_on → Observer Camera System (Attention Cycle, at element scale)
    requires → Awareness Lighting System (exists only at L1+)
Success and State Grammar
    constrains → Idealized UI Rule
Sigil Reveal
    is_example_of → Reveal Grammar (Resolution class)
    constrained_by expressed as: Motion Budget Principle constrains → Sigil Reveal
Silent-First Principle
    supports → Observer Law   (beat-cutting prohibition)
Format Canon
    constrains → Sequence Architecture, Scene Composition Rules
Idealized UI Rule
    constrains → Awareness Lighting System inputs

Reveal Grammar
    requires → Temporal Grammar
    depends_on → Awareness Lighting System, Focus Field System, Observer Camera System
Emergence, Resolution, Assembly, Disclosure
    is_example_of → Reveal Grammar (classes)
Transition Grammar
    requires → Reveal Grammar, Observer Camera System, Awareness Lighting System
    defines → Persistent Field, Loop Closure
Loop Closure
    constrains → Sequence Architecture (first and last Beat)
    requires → Awareness Lighting System (state parity), Brand Constants (Conviction frame)
Persistent Field
    depends_on → AwarenessTimeline (single-writer)
Typographic Motion System
    requires → Brand Constants, Reveal Grammar
    defines → Claim
Sequence Architecture
    implements → Emotional Arc
    requires → Transition Grammar, Reveal Grammar, Typographic Motion System, Format Canon
    defines → Beat, Product Atom, Inversion Rule
Material Specification
    depends_on → Brand Constants, Awareness Lighting System
    constrains → all rendering
Remotion Component Specification
    implements → Temporal Grammar, Material Specification, all Part II-III systems
    defines → Single-Writer Rule, Data-Authoring Rule
Decrescendo Principle
    constrains → Sequence Architecture (post-Discovery Beats)
    extends → Emotional Arc (Confidence through Conviction expression)
Accelerating Stagger
    extends → Typographic Motion System (Recognition reveal)
Reference Deconstruction (Part V)
    supports → Transition Grammar, Sequence Architecture, Typographic Motion System,
               Temporal Grammar (deceleration-asymmetry invariant, measured)
    contradicts → (resolved as Rejected patterns: emissive/hue-based hierarchy,
                   parallel entrances; scale-pop rejection retracted by DDR-015)
```

---

# APPENDIX C — DDR LOG

```text
DDR-001
Version:       0.1.0
Decision:      The Central Brand Metaphor is "Intelligence without perception is
               incomplete; Ocular expands perception."
Previous:      none
Reason:        Aligns the motion language with the product thesis (narrative
               communication foundation).
Consequences:  Root of ontology; all chapters derive from it.

DDR-002
Version:       0.1.0
Decision:      Lighting represents awareness rather than materiality.
Previous:      none
Reason:        Aligns lighting with the Central Brand Metaphor; luminance contrast
               is the fastest hierarchy channel (Perception Model, assumption 5).
Consequences:  Awareness Lighting System defined as a four-state machine;
               Brand Physics Law 2 established.

DDR-003
Version:       0.1.0
Decision:      Canonical frame rate is 30 fps; all duration tokens resolve to
               integer frames.
Previous:      none
Reason:        Engineering constraint — Remotion determinism requires frame-integer
               timing.
Consequences:  Temporal Grammar duration table fixed; Anticipation Lead = 6 frames.

DDR-004
Version:       0.1.0
Decision:      The Discovery event (L1→L2 illumination rise) occurs exactly once
               per narrative and is the only t-monumental lighting transition.
Previous:      none
Reason:        Repetition of the highest-salience event devalues the narrative
               climax (perception foundation).
Consequences:  Emotional Arc rule 4; Awareness Lighting rules 2–3.

DDR-005
Version:       0.1.0
Decision:      Springs, bounces, and elastic easing are prohibited; overshoot
               tolerance capped at 0.5% on e-reveal only.
Previous:      none
Reason:        Bounce encodes playfulness; Ocular's character is deliberate
               (narrative foundation; Brand Physics Law 7).
Consequences:  Temporal Grammar easing whitelist; MotionLedger lint rule.

DDR-006
Version:       0.2.0
Decision:      Brand palette is exactly Ocular Ink #0B0F17 and Ocular White,
               bound to the L0/L3 awareness poles (Polarity Rule).
Previous:      Temperature bindings existed without color anchors.
Reason:        Values measured from master logo assets; binding the palette to
               the awareness axis makes color itself implement the Central
               Brand Metaphor (narrative foundation).
Consequences:  Brand Constants chapter added; Awareness Lighting extended with
               environment color bindings; accent colors prohibited pending DDR.

DDR-007
Version:       0.2.0
Decision:      The Catchlight is the sole brand element representing perception
               igniting; the Sigil Reveal is the canonical logo entrance.
Previous:      none
Reason:        The logomark's construction (iris + specular highlight) already
               encodes the metaphor; motion should activate existing anatomy
               rather than invent new symbols (narrative foundation).
Consequences:  Logo motion rules I.6.7–9; SigilReveal engineering component.

DDR-008
Version:       0.2.0
Decision:      Format Canon fixed at f-social-vertical (default), f-social-square,
               f-web-hero; vertical-first authoring is mandatory.
Previous:      Formats listed as an open question.
Reason:        Distribution is social + website; the reference video is itself
               20 s vertical (engineering + narrative foundations).
Consequences:  Safe-area rules; Sequence Architecture compression scope defined.

DDR-009
Version:       0.2.0
Decision:      Silent-First Principle adopted: compositions must be fully legible
               with zero audio; audio may reinforce but never motivate timing.
Previous:      Audio policy open.
Reason:        No score budget exists and social autoplay is muted (engineering
               constraint); also structurally protects the beat-cutting
               prohibition (Brand Physics, Law 1).
Consequences:  Temporal Grammar is the sole rhythm authority; audio extension
               point deferred.

DDR-010
Version:       0.2.0
Decision:      Idealized UI Rule adopted: no real screen capture; all product UI
               rebuilt to natively obey lighting, palette, and budget systems.
Previous:      Capture policy open.
Reason:        User decision (no capture); rebuilt UI removes the need for a
               grading pipeline and guarantees Awareness Lighting compliance
               (engineering foundation).
Consequences:  Capture-grading extension point removed from II.8; Idealized UI
               gray scale added as I.6 extension point.

DDR-011
Version:       0.3.0
Decision:      Canonical typeface is Poppins (Bold 700 display, Medium 500
               support, Regular 400 UI). Logomark construction: perfect circle
               with Catchlight center at 40 degrees clockwise from vertical.
Previous:      "Bold geometric sans, pending confirmation."
Reason:        Confirmed by brand owner; construction values from master asset.
Consequences:  I.6 rule 5 updated; Typographic Motion System type canon fixed.

DDR-012
Version:       0.3.0
Decision:      Hard cuts prohibited in all formats; all boundaries operate on
               the Persistent Field via three canonical classes.
Previous:      Cut policy implied (II.7 rule 2) but boundary system undefined.
Reason:        Reference deconstruction: 20 s with zero cuts proves continuity
               is achievable at maximum compression (perception + narrative
               foundations); continuity is the brand's own claim.
Consequences:  Transition Grammar completed; II.7 rule 2 now delegated to it.

DDR-013
Version:       0.3.0
Decision:      Short-form compression fixed at five Beats with the Inversion
               Rule (Recognition-first cold open on the Product Atom); Discovery
               at 45-55% of duration in all formats.
Previous:      Compression listed as Draft scope.
Reason:        Reference-derived (cold-audience cadence) plus correction of the
               reference's late-climax structure (narrative foundation).
Consequences:  Sequence Architecture completed; feature-parade and late-climax
               registered as anti-patterns.

DDR-014
Version:       0.3.0
Decision:      Reference patterns rejected from canon: scale-pop entrances with
               overshoot, hue-based hierarchy, parallel simultaneous entrances.
Previous:      none
Reason:        Each contradicts an existing foundation (Gravity Law, Polarity
               Rule / two-color canon, Motion Budget Principle).
Consequences:  Recorded in Part V.3 disposition table as prohibited patterns.

DDR-015
Version:       0.4.0
Decision:      Part V.3 (0.3.0) is superseded by the deep-pass deconstruction:
               995 frames at native 50 fps, measured on the composition viewport
               only. Corrections: (a) the 0.3.0 luminance findings measured the
               portfolio desk wrapper, not the composition — the composition's
               true arc is a 110->13 descent with a terminal +70% relative step;
               (b) "scale-pop entrances with overshoot" retracted — measured
               overshoot is 0.0% and entrances are extreme fast-attack/long-
               decay (78-95% of duration below half peak velocity); the spring
               prohibition stands on Brand Physics Law 7 alone.
Previous:      0.3.0 V.3 findings and the scale-pop clause of DDR-014.
Reason:        2% sampling and wrapper contamination invalidated the prior
               measurements (correctness outranks all other priorities, S2).
Consequences:  V.3 rewritten; II.10 rule 4 and rationale corrected; II.11
               rationale corrected; III.14 validation values corrected.

DDR-016
Version:       0.4.0
Decision:      The Material Specification
    depends_on → Brand Constants, Awareness Lighting System
    constrains → all rendering
Remotion Component Specification
    implements → Temporal Grammar, Material Specification, all Part II-III systems
    defines → Single-Writer Rule, Data-Authoring Rule
Decrescendo Principle: post-Discovery, per-Beat motion spend
               is monotonically non-increasing and holds are monotonically
               non-decreasing, ending in the composition's longest stillness.
Previous:      Confidence-stage "decelerating rhythm" (I.4) without a
               timeline-level rule.
Reason:        Measured: the reference's motion energy collapses after 12.56 s
               and all stillness holds occur in the final 35%; resolution is
               subtraction of motion (perception + narrative foundations).
Consequences:  III.14 rule 9 added; SequencePlan validation extended.

DDR-017
Version:       0.4.0
Decision:      The Accelerating Stagger: the sanctioned Recognition per-word
               reveal uses intervals decreasing from t-swift to t-micro.
Previous:      Fixed t-micro stagger (II.12 rule 6, v0.3.0).
Reason:        Measured 440->220 ms accelerating cadence produces building
               momentum inside a single reveal (perception foundation), adopted
               on Ocular's token scale.
Consequences:  II.12 rule 6 amended; ontology entry added.

DDR-018
Version:       0.5.0
Decision:      The Sigil Reveal is redefined in contrast-relative terms and
               executes at both polarity poles; the Catchlight resolution is
               its invariant core.
Previous:      Defined against an L0 field only (v0.2.0).
Reason:        First derived instance exposed the defect: the canonical logo
               moment is the L3 Conviction frame, where the L0-specific
               definition cannot execute (internal consistency, S2).
Consequences:  I.6 rule 7 rewritten with dark-pole and light-pole instances;
               launch-short storyboard B5 now conforms.

DDR-019
Version:       0.5.0
Decision:      The Gaze Ring is registered as a canonical entity: Logomark-
               derived geometry, Attention Cycle behavior, existing only at
               L1+; its absence at L0 depicts blindness. One per composition.
Previous:      Unregistered; used ad hoc in the first derived instance.
Reason:        It is the product's perception made visible and recurs in every
               composition depicting the agent; an unregistered recurring
               entity is an ontology defect (S2, canon preservation).
Consequences:  I.6 rules 10-14 added; Idealized UI Rule extended.

DDR-020
Version:       0.5.0
Decision:      Success and State Grammar: UI state changes are expressed by
               luminance step, focus resolution, and Gaze Ring confirm settle
               only; color flashes, checkmark pops, and glow bursts prohibited.
Previous:      Undefined; accent prohibition left a vacuum.
Reason:        Derivation exposed that the no-accent rule removed the industry-
               default success vocabulary without supplying a replacement.
Consequences:  I.6 rule 15 added; resolves Gap Log item 3.

DDR-021
Version:       0.6.0
Decision:      Loop Closure adopted as an optional per-composition boundary
               condition: final frame identical to frame 0, enforced by
               awareness-state parity, subject parity, and motion parity on
               both bookend Beats. Looping compositions open at L3.
Previous:      Listed as a future extension point in II.11.
Reason:        The website hero is a continuous-loop placement where a hard
               wrap advertises its own seam (engineering + narrative). The
               metaphor supports it: perception is a state that can be lost
               and regained, which a loop dramatizes.
Consequences:  II.11 rules 7-11 added; SequenceRenderer gains loop parity
               validation; III.14 first/last Beat design is jointly
               constrained when loop is declared.

DDR-022
Version:       0.6.0
Decision:      The motion system is a separate package from the consuming
               application; only rendered artifacts cross the boundary.
               Delivery set: MP4 + WebM + Conviction-frame poster. All format
               variants render from shared scenes via format-specific plans.
Previous:      Undefined; implied by the Format Canon but never stated.
Reason:        The application must not carry a render toolchain it never
               invokes in production (engineering constraint); cropping a hero
               render to produce social cuts violates vertical-first authoring.
Consequences:  IV.16 rules 15-18 added; ~4 MB hero budget registered as a
               IV.15 compliance signal.
```

---

# APPENDIX D — OPEN QUESTIONS

**[Living]** Items blocking promotion of remaining Draft chapters:

1. **Focus Field parameters** (II.9) — canonical blur-radius scale and rack-focus timing need definition; no external inputs required.
2. **Scene Composition grid** (III.13) — spatial grid and negative-space quotas need definition; no external inputs required.

Resolved since 0.4.0: engineering layer (IV.15, IV.16), Sigil Reveal polarity defect (DDR-018), Gaze Ring registration (DDR-019), success-state vacuum (DDR-020), Idealized UI neutral scale (§IV.15 rule 1).
Resolved since 0.2.0: reference frame access and deconstruction (Part V.3), wordmark typeface (DDR-011).
Resolved since 0.1.0: format targets (DDR-008), audio policy (DDR-009), UI capture policy (DDR-010), brand color values (DDR-006).

---

_End of Version 0.6.0._
