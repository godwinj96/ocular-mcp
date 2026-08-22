import { createContext, useContext, useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { ANTICIPATION_LEAD_FRAMES, T, tokenInterpolate } from '../tokens/temporal.js';
import { N } from '../tokens/brand.js';
import { SHADOW_L2 } from '../tokens/material.js';
import { mixOklchHex } from '../tokens/color.js';

// Awareness Lighting System — Motion Design Bible §II.8. Illumination as
// the visible implementation of Awareness. This module is the sole writer
// of lighting/field state (§IV.16 rule 2, Single-Writer Rule) — no scene
// may set these values directly, only read them.

export type AwarenessState = 'L0' | 'L1' | 'L2' | 'L3';

export type AwarenessEvent = { state: AwarenessState; atFrame: number };

export type AwarenessValue = {
  state: AwarenessState;
  keyLuminance: number; // 0-100
  contrastRatio: number; // e.g. 5 means 5:1
  tempK: number;
  fieldColor: string;
  shadowOpacity: number;
};

// §II.8 rule 1 — the four canonical states.
const STATE_TABLE: Record<
  AwarenessState,
  {
    luminanceRange: [number, number];
    contrastRange: [number, number];
    tempK: number;
    field: string;
    hasShadow: boolean;
  }
> = {
  L0: {
    luminanceRange: [15, 25],
    contrastRange: [1, 2],
    tempK: 6500,
    field: N['000'],
    hasShadow: false,
  },
  L1: {
    luminanceRange: [35, 50],
    contrastRange: [3, 5],
    tempK: 6000,
    field: N['000'],
    hasShadow: false,
  },
  L2: {
    luminanceRange: [55, 75],
    contrastRange: [5, 8],
    tempK: 5250,
    field: N['100'],
    hasShadow: true,
  },
  L3: {
    luminanceRange: [80, 95],
    contrastRange: [8, 12],
    tempK: 4750,
    field: N['900'],
    hasShadow: true,
  },
};

const STATE_ORDER: AwarenessState[] = ['L0', 'L1', 'L2', 'L3'];

function midpoint([a, b]: [number, number]): number {
  return (a + b) / 2;
}

// §II.8 rule 3 — the L1->L2 transition is THE Discovery event: t-monumental
// duration. All other transitions (rule 4): t-scenic.
function transitionDurationFrames(from: AwarenessState, to: AwarenessState): number {
  if (from === 'L1' && to === 'L2') return T.monumental;
  return T.scenic;
}

// §II.8 rule 2 — state transitions are monotonic within a narrative after
// Discovery; pre-Discovery only L0<->L1 oscillation is permitted. §II.8
// rule 3 — the Discovery event occurs exactly once. Runs in dev only; a
// misauthored plan should fail loudly, not silently render wrong.
function validateEvents(events: AwarenessEvent[]): void {
  if (process.env.NODE_ENV === 'production') return;
  const sorted = [...events].sort((a, b) => a.atFrame - b.atFrame);
  let discoveryCount = 0;
  let sawL2Plus = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!.state;
    const next = sorted[i]!.state;
    if (prev === 'L1' && next === 'L2') discoveryCount++;
    const prevIdx = STATE_ORDER.indexOf(prev);
    const nextIdx = STATE_ORDER.indexOf(next);
    if (sawL2Plus && nextIdx < prevIdx) {
      throw new Error(
        `AwarenessTimeline: awareness regressed from ${prev} to ${next} after reaching L2+ ` +
          `(§II.8 rule 2 — awareness never regresses after the Discovery event).`,
      );
    }
    if (nextIdx >= STATE_ORDER.indexOf('L2')) sawL2Plus = true;
  }
  if (discoveryCount > 1) {
    throw new Error(
      `AwarenessTimeline: found ${discoveryCount} L1->L2 transitions; the Discovery event must occur ` +
        `exactly once per narrative (§II.8 rule 3, §I.4 rule 4).`,
    );
  }
}

const AwarenessContext = createContext<AwarenessValue | null>(null);

export function useAwareness(): AwarenessValue {
  const value = useContext(AwarenessContext);
  if (!value) {
    throw new Error(
      'useAwareness() called outside an <AwarenessTimeline> — every scene needs one at the root.',
    );
  }
  return value;
}

export function AwarenessTimeline({
  events,
  children,
}: {
  events: AwarenessEvent[];
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();

  const value = useMemo<AwarenessValue>(() => {
    validateEvents(events);
    const sorted = [...events].sort((a, b) => a.atFrame - b.atFrame);
    const first = sorted[0];
    if (!first) {
      throw new Error('AwarenessTimeline requires at least one AwarenessEvent.');
    }

    // Find the active segment: the most recent event at/after applying its
    // own Anticipation Lead, and the next one (if any) to interpolate toward.
    let activeIndex = 0;
    for (let i = 0; i < sorted.length; i++) {
      const leadFrame = sorted[i]!.atFrame - ANTICIPATION_LEAD_FRAMES;
      if (frame >= leadFrame) activeIndex = i;
    }

    const current = sorted[activeIndex]!;
    const next = sorted[activeIndex + 1];

    if (!next || frame < current.atFrame - ANTICIPATION_LEAD_FRAMES) {
      const s = STATE_TABLE[current.state];
      return {
        state: current.state,
        keyLuminance: midpoint(s.luminanceRange),
        contrastRatio: midpoint(s.contrastRange),
        tempK: s.tempK,
        fieldColor: s.field,
        shadowOpacity: s.hasShadow ? SHADOW_L2.opacity : 0,
      };
    }

    const durationFrames = transitionDurationFrames(current.state, next.state);
    const transitionStart = next.atFrame - ANTICIPATION_LEAD_FRAMES;
    const progress = tokenInterpolate(
      frame,
      transitionStart,
      durationFrames === T.monumental ? 'monumental' : 'scenic',
      0,
      1,
      'shift',
    );

    const from = STATE_TABLE[current.state];
    const to = STATE_TABLE[next.state];
    return {
      state: progress >= 1 ? next.state : current.state,
      keyLuminance:
        midpoint(from.luminanceRange) +
        (midpoint(to.luminanceRange) - midpoint(from.luminanceRange)) * progress,
      contrastRatio:
        midpoint(from.contrastRange) +
        (midpoint(to.contrastRange) - midpoint(from.contrastRange)) * progress,
      tempK: from.tempK + (to.tempK - from.tempK) * progress,
      fieldColor: mixOklchHex(from.field, to.field, progress),
      shadowOpacity:
        (from.hasShadow ? SHADOW_L2.opacity : 0) +
        ((to.hasShadow ? SHADOW_L2.opacity : 0) - (from.hasShadow ? SHADOW_L2.opacity : 0)) *
          progress,
    };
  }, [events, frame]);

  const style = useMemo<React.CSSProperties>(
    () =>
      ({
        '--field': value.fieldColor,
        '--key-lum': String(value.keyLuminance),
        '--contrast': String(value.contrastRatio),
        '--shadow-op': String(value.shadowOpacity),
      }) as React.CSSProperties,
    [value],
  );

  return (
    <AwarenessContext.Provider value={value}>
      {/* The Persistent Field (§II.11 rule 1) IS this div's background —
          structurally, no scene can "cut" it, since nothing renders a field
          of its own; this div is the only layer beneath every Beat. */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: value.fieldColor, ...style }}>
        {children}
      </div>
    </AwarenessContext.Provider>
  );
}
