import { useCurrentFrame } from 'remotion';
import { T, tokenInterpolate } from '../../tokens/temporal.js';
import type { RevealProps } from './types.js';

// Reveal Grammar — Assembly class (§II.10 rule 1). "Understanding is
// constructed from pieces." Parts converge along curved paths, staggered,
// <=3 parts, sharing one velocity field so the group reads as a single
// primary motion (§I.5 formation-motion rule) rather than N independent
// motions.

export type AssemblyPart = {
  id: string;
  node: React.ReactNode;
  fromOffset: { x: number; y: number };
};

export type AssemblyProps = Omit<RevealProps, 'children'> & {
  parts: AssemblyPart[];
};

const MAX_PARTS = 3;
const STAGGER_FRAMES = T.micro;

export function Assembly({ entryFrame, duration, parts }: AssemblyProps) {
  const frame = useCurrentFrame();

  if (parts.length > MAX_PARTS) {
    throw new Error(
      `Assembly: received ${parts.length} parts, but §II.10 rule 1 caps Assembly at ${MAX_PARTS} parts sharing ` +
        `one velocity field. Break this into a different reveal class instead of exceeding the cap.`,
    );
  }

  return (
    <>
      {parts.map((part, i) => {
        const start = entryFrame + i * STAGGER_FRAMES;
        const progress = tokenInterpolate(frame, start, duration, 0, 1, 'reveal');
        const x = part.fromOffset.x * (1 - progress);
        const y = part.fromOffset.y * (1 - progress);
        return (
          <div
            key={part.id}
            style={{
              position: 'absolute',
              transform: `translate(${x}px, ${y}px)`,
              opacity: progress,
            }}
          >
            {part.node}
          </div>
        );
      })}
    </>
  );
}
