// Motion Budget Principle — Motion Design Bible §I.5. A validation layer,
// not a renderer (§IV.16 rule 8): every animated element registers its
// class and active interval; this module validates the budget and throws
// loudly in development. Deliberately framework-agnostic (no React) so it
// can validate a SequencePlan's declared motions statically, which is how
// SequenceRenderer uses it — Remotion re-renders the whole tree per frame,
// so registering "live" during render would just rebuild this same data on
// every frame for no benefit.

export type MotionClass = 'primary' | 'subordinate' | 'ambient';

export type MotionEntry = {
  id: string;
  class: MotionClass;
  startFrame: number;
  endFrame: number;
};

// §I.5 rule 1 — canonical motion costs.
export const MOTION_COST: Record<MotionClass, number> = {
  primary: 0.7,
  subordinate: 0.3,
  ambient: 0.1,
};

const MAX_CONCURRENT_AMBIENT = 2;
const MAX_BUDGET = 1.0;
const CLARITY_CONVICTION_MAX_SPEND = 0.1;

export function spendAtFrame(entries: MotionEntry[], frame: number): number {
  return entries
    .filter((e) => frame >= e.startFrame && frame < e.endFrame)
    .reduce((sum, e) => sum + MOTION_COST[e.class], 0);
}

export type ValidateOptions = {
  totalFrames: number;
  // Frame ranges (inclusive start, exclusive end) during which the
  // Clarity/Conviction stages' stricter 0.1 cap applies (§I.5 rule 5).
  clarityConvictionRanges?: [number, number][];
};

// §I.5 rule 1-5. Throws with a canon-referenced message on the first
// violation found (mirrors §IV.16 rule 14's "fails the build with the
// violated rule's canon reference").
export function validateMotionLedger(entries: MotionEntry[], options: ValidateOptions): void {
  const { totalFrames, clarityConvictionRanges = [] } = options;

  // §I.5 rule 3 — checked first, so a sequencing violation reports its own
  // specific message rather than being masked by the (also true, but less
  // actionable) budget-overflow error that the same bad plan will usually
  // also trip: a new primary may begin only after the previous primary has
  // entered its deceleration phase (final 30% of its duration).
  const primaries = entries
    .filter((e) => e.class === 'primary')
    .sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 1; i < primaries.length; i++) {
    const prev = primaries[i - 1]!;
    const curr = primaries[i]!;
    const prevDuration = prev.endFrame - prev.startFrame;
    const prevDecelerationStart = prev.startFrame + prevDuration * 0.7;
    if (curr.startFrame < prevDecelerationStart) {
      throw new Error(
        `MotionLedger: primary motion "${curr.id}" starts at frame ${curr.startFrame}, before primary ` +
          `"${prev.id}"'s deceleration phase begins at frame ${prevDecelerationStart.toFixed(1)} (§I.5 rule 3).`,
      );
    }
  }

  for (let frame = 0; frame < totalFrames; frame++) {
    const active = entries.filter((e) => frame >= e.startFrame && frame < e.endFrame);
    const spend = active.reduce((sum, e) => sum + MOTION_COST[e.class], 0);

    if (spend > MAX_BUDGET + 1e-9) {
      throw new Error(
        `MotionLedger: frame ${frame} spends ${spend.toFixed(2)} > 1.0 (§I.5 — motion budget principle). ` +
          `Active: ${active.map((e) => `${e.id}(${e.class})`).join(', ')}`,
      );
    }

    const ambientCount = active.filter((e) => e.class === 'ambient').length;
    if (ambientCount > MAX_CONCURRENT_AMBIENT) {
      throw new Error(
        `MotionLedger: frame ${frame} has ${ambientCount} concurrent ambient motions > 2 (§I.5 rule 1).`,
      );
    }

    const inClarityConviction = clarityConvictionRanges.some(
      ([start, end]) => frame >= start && frame < end,
    );
    if (inClarityConviction && spend > CLARITY_CONVICTION_MAX_SPEND + 1e-9) {
      throw new Error(
        `MotionLedger: frame ${frame} spends ${spend.toFixed(2)} > 0.1 during a Clarity/Conviction range (§I.5 rule 5).`,
      );
    }
  }
}
