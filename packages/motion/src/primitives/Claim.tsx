import { createContext, useContext, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { T, tokenInterpolate } from '../tokens/temporal.js';
import { CLAIM_MAX_WORDS, TYPE_ROLES } from '../tokens/brand.js';
import { TYPE_LINE_HEIGHT, TYPE_SIZE_PX, TYPE_TRACKING } from '../tokens/material.js';
import { useAwareness } from '../systems/AwarenessTimeline.js';

// Typographic Motion System — Motion Design Bible §II.12. The Claim: a
// single typographic message of at most eight words expressing exactly one
// idea (§II.12 rule 4). Type never moves while being read (rule 7) — this
// component enforces that by construction: the reveal ramp only ever
// touches opacity, never position, once past its own entry window.

export type ClaimReveal = 'Emergence' | 'Resolution';

export type ClaimProps = {
  text: string;
  role?: keyof typeof TYPE_ROLES;
  reveal?: ClaimReveal;
  entryFrame: number;
  stagger?: 'accelerating';
};

// One composition-wide slot: the accelerating stagger is permitted once per
// composition, at Recognition only (§II.12 rule 6).
const AcceleratingStaggerContext = createContext<{ claimed: { current: boolean } } | null>(null);

export function AcceleratingStaggerScope({ children }: { children: React.ReactNode }) {
  const claimed = useRef(false);
  const value = useMemo(() => ({ claimed }), []);
  return (
    <AcceleratingStaggerContext.Provider value={value}>
      {children}
    </AcceleratingStaggerContext.Provider>
  );
}

function useClaimAcceleratingStaggerSlot(wants: boolean): void {
  const ctx = useContext(AcceleratingStaggerContext);
  if (!wants) return;
  if (!ctx) {
    throw new Error(
      'Claim: stagger="accelerating" requires an <AcceleratingStaggerScope> ancestor.',
    );
  }
  if (ctx.claimed.current) {
    throw new Error(
      'Claim: the accelerating stagger is permitted once per composition, at Recognition only (§II.12 rule 6).',
    );
  }
  ctx.claimed.current = true;
}

// §II.12 rule 5 — dwell time before exit may begin: t-deliberate + 80ms/word.
// §IV.16 rule 10 formalizes this as T.deliberate + words * 2.4 frames
// (80ms @30fps = 2.4 frames).
export function claimDwellFrames(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return T.deliberate + words * 2.4;
}

export function Claim({
  text,
  role = 'display',
  reveal = 'Emergence',
  entryFrame,
  stagger,
}: ClaimProps) {
  const frame = useCurrentFrame();
  const awareness = useAwareness();
  useClaimAcceleratingStaggerSlot(stagger === 'accelerating');

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > CLAIM_MAX_WORDS) {
    throw new Error(
      `Claim: "${text}" has ${words.length} words > ${CLAIM_MAX_WORDS}-word ceiling (§II.12 rule 4).`,
    );
  }
  if (reveal === 'Resolution' && awareness.state === 'L0') {
    throw new Error('Claim: reveal="Resolution" is prohibited at L0 (§II.10 rule 3).');
  }

  const roleToken = TYPE_ROLES[role];
  const sizeRange = TYPE_SIZE_PX[role];
  const color = awareness.state === 'L0' || awareness.state === 'L1' ? '#FFFFFF' : '#0B0F17';

  const opacity =
    stagger === 'accelerating'
      ? undefined // per-word opacity computed below
      : tokenInterpolate(
          frame,
          entryFrame,
          'base',
          0,
          1,
          reveal === 'Resolution' ? 'shift' : 'reveal',
        );

  const style: React.CSSProperties = {
    fontFamily: roleToken.fontFamily,
    fontWeight: roleToken.fontWeight,
    fontSize: sizeRange[0],
    lineHeight: role === 'display' ? TYPE_LINE_HEIGHT.display : TYPE_LINE_HEIGHT.other,
    letterSpacing: `${(role === 'display' ? TYPE_TRACKING.display : TYPE_TRACKING.other) * 100}%`,
    color,
    margin: 0,
  };

  if (stagger !== 'accelerating') {
    return <p style={{ ...style, opacity }}>{text}</p>;
  }

  // §II.12 rule 6 / DDR-017 — Accelerating Stagger: per-word intervals
  // decrease monotonically from t-swift (8f) to t-micro (4f).
  const intervals = accelerateIntervals(words.length);
  let cursor = entryFrame;
  const wordStarts = intervals.map((interval) => {
    const start = cursor;
    cursor += interval;
    return start;
  });

  return (
    <p style={style}>
      {words.map((word, i) => {
        const wOpacity = tokenInterpolate(frame, wordStarts[i]!, 'swift', 0, 1, 'reveal');
        return (
          <span key={i} style={{ opacity: wOpacity }}>
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}

function accelerateIntervals(wordCount: number): number[] {
  // Monotonically decreasing from T.swift to T.micro across the word count.
  const steps = Math.max(1, wordCount - 1);
  return Array.from({ length: wordCount }, (_, i) => {
    const t = steps === 0 ? 0 : i / steps;
    return Math.round(T.swift + (T.micro - T.swift) * t);
  });
}
