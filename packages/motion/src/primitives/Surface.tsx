import { N } from '../tokens/brand.js';
import { RADIUS_PX, SHADOW_L2 } from '../tokens/material.js';
import { useAwareness } from '../systems/AwarenessTimeline.js';

// Surface — a Material Specification card/container (§IV.15 rules 6-7).
// This is the missing piece between "Idealized UI Rule" (§I.6 rule 14 —
// product UI is rebuilt, not screenshotted) and an actual visible surface:
// without it, "rebuilt UI" degrades into bare text on the flat field,
// which reads as unstyled rather than restrained. Depth here comes from
// exactly the three sanctioned means (§IV.15 rule 5) — layering (a raised
// fill tone off the neutral scale), a single soft directional shadow, and
// nothing else. No gradient, no glow, no border-as-accent: the fill tone
// and shadow alone carry materiality.

export type SurfaceProps = {
  children: React.ReactNode;
  /** Off the neutral scale: 'raised' one step lighter/darker than field, 'card' two steps. */
  elevation?: 'raised' | 'card';
  radius?: keyof typeof RADIUS_PX;
  padding?: number;
  style?: React.CSSProperties;
};

export function Surface({
  children,
  elevation = 'card',
  radius = 'md',
  padding = 20,
  style,
}: SurfaceProps) {
  const awareness = useAwareness();
  const onDark = awareness.state === 'L0' || awareness.state === 'L1';

  // n-100/n-200 read as "raised"/"card" on dark fields; n-800/n-700 do the
  // same job on light fields (Material Spec's dark/light neutral pairing).
  const fill =
    elevation === 'raised' ? (onDark ? N['100'] : N['800']) : onDark ? N['200'] : N['700'];
  const borderTone = onDark ? N['300'] : N['600'];

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: fill,
        borderRadius: RADIUS_PX[radius],
        border: `1px solid ${borderTone}`,
        padding,
        boxShadow: `0 ${SHADOW_L2.yOffsetFrac * 100}px ${SHADOW_L2.blurFrac * 100}px rgba(0,0,0,${awareness.shadowOpacity})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
