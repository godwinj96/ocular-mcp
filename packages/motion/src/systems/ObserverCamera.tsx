import { createContext, useContext, useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import {
  ANTICIPATION_LEAD_FRAMES,
  DurationToken,
  T,
  tokenInterpolate,
} from '../tokens/temporal.js';

// Observer Camera System — Motion Design Bible §II.7. The camera as
// protagonist: a conscious observer whose attention anticipates, attends,
// and confirms narrative subjects (the Attention Cycle, §II.7 rule 1).
//
// Interpreted here as a 2D viewport transform (translate + scale) over flat
// Idealized UI content, not a literal 3D camera — this project's scenes are
// flat panels, not volumetric scenes. Push-ins read as "dolly," reframes
// read as "truck." This is a deliberate engineering interpretation of §II.7,
// not a bible rule (flagged in the consuming project's plan doc). It stays
// consistent with §IV.15 rule 5's own allowance of scale-with-distance as a
// depth cue.

export type CameraMove = 'dolly' | 'truck' | 'pedestal' | 'pan' | 'tilt';

export type AttentionTarget = {
  subject: string;
  arrivalFrame: number;
  framing: { x: number; y: number; scale: number };
  move: CameraMove;
  attendDuration?: DurationToken; // default 'deliberate'
};

export type CameraTransform = { x: number; y: number; scale: number; subject: string };

const REST_FRAMING = { x: 0, y: 0, scale: 1 };

// §II.7 rule 5 — gently curved approach path, lateral deviation <= 8% of
// path length. A small perpendicular sine bulge over progress approximates
// a single-arc spline without needing real spline math for a 2D pan/scale.
function arcLateralOffset(progress: number, pathLength: number): number {
  const maxDeviation = pathLength * 0.08;
  return Math.sin(progress * Math.PI) * maxDeviation;
}

// §IV.16 rule 7 (build-time rejection) — angular-velocity/rotation checks
// are elided here since this is a 2D transform, not a literal camera; the
// dev-only guard that *does* apply is Anticipate-window overlap, checked
// below.
function validateTargets(targets: AttentionTarget[]): void {
  if (process.env.NODE_ENV === 'production') return;
  const sorted = [...targets].sort((a, b) => a.arrivalFrame - b.arrivalFrame);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevAttendStart = prev.arrivalFrame - T[prev.attendDuration ?? 'deliberate'];
    const currAnticipateStart =
      curr.arrivalFrame - T[curr.attendDuration ?? 'deliberate'] - ANTICIPATION_LEAD_FRAMES;
    if (currAnticipateStart < prevAttendStart) {
      throw new Error(
        `ObserverCamera: target "${curr.subject}"'s Anticipate window overlaps target "${prev.subject}"'s Attend ` +
          `phase (§II.7: the camera never cuts or reacts mid-move — one Attention Cycle completes before the next begins).`,
      );
    }
  }
}

const CameraContext = createContext<CameraTransform>({ ...REST_FRAMING, subject: 'rest' });

export function useCamera(): CameraTransform {
  return useContext(CameraContext);
}

export function ObserverCamera({
  targets,
  children,
}: {
  targets: AttentionTarget[];
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();

  const transform = useMemo<CameraTransform>(() => {
    validateTargets(targets);
    if (targets.length === 0) return { ...REST_FRAMING, subject: 'rest' };

    const sorted = [...targets].sort((a, b) => a.arrivalFrame - b.arrivalFrame);

    let activeIndex = -1;
    for (let i = 0; i < sorted.length; i++) {
      const attendDuration = T[sorted[i]!.attendDuration ?? 'deliberate'];
      const anticipateStart = sorted[i]!.arrivalFrame - attendDuration - ANTICIPATION_LEAD_FRAMES;
      if (frame >= anticipateStart) activeIndex = i;
    }

    if (activeIndex === -1) {
      return { ...REST_FRAMING, subject: 'rest' };
    }

    const target = sorted[activeIndex]!;
    const attendDuration = T[target.attendDuration ?? 'deliberate'];
    const anticipateStart = target.arrivalFrame - attendDuration - ANTICIPATION_LEAD_FRAMES;
    const fromFraming = activeIndex > 0 ? sorted[activeIndex - 1]!.framing : REST_FRAMING;

    // Confirm phase + trailing stillness: once arrived, hold (§II.7 rule 1c).
    if (frame >= target.arrivalFrame) {
      return { ...target.framing, subject: target.subject };
    }

    const windowLength = attendDuration + ANTICIPATION_LEAD_FRAMES;
    const rawProgress = (frame - anticipateStart) / windowLength;
    // e-observe across the whole Anticipate+Attend window: its own long
    // asymmetric settle already keeps early velocity low (the Anticipate
    // character) before the bulk of translation happens late (Attend).
    const progress = tokenInterpolate(
      frame,
      anticipateStart,
      target.attendDuration ?? 'deliberate',
      0,
      1,
      'observe',
    );

    const dx = target.framing.x - fromFraming.x;
    const dy = target.framing.y - fromFraming.y;
    const pathLength = Math.sqrt(dx * dx + dy * dy);
    const lateral = arcLateralOffset(Math.min(1, Math.max(0, rawProgress)), pathLength);
    // Perpendicular to the direct path.
    const perpX = pathLength > 0 ? -dy / pathLength : 0;
    const perpY = pathLength > 0 ? dx / pathLength : 0;

    return {
      x: fromFraming.x + dx * progress + perpX * lateral,
      y: fromFraming.y + dy * progress + perpY * lateral,
      scale: fromFraming.scale + (target.framing.scale - fromFraming.scale) * progress,
      subject: target.subject,
    };
  }, [targets, frame]);

  return (
    <CameraContext.Provider value={transform}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </CameraContext.Provider>
  );
}
