import { useRackFocusBlur } from '../../systems/FocusField.js';
import type { RevealProps } from './types.js';

// Reveal Grammar — Resolution class (§II.10 rule 1). "Uncertainty becomes
// certainty." Subject sharpens from defocus into full focus, e-shift.
// Requires the Focus Field System and is prohibited at L0 (§II.10 rule 3) —
// enforced inside useRackFocusBlur.

export function Resolution({ entryFrame, duration, children }: RevealProps) {
  const blurPx = useRackFocusBlur(entryFrame, duration, 'toSharp');
  return <div style={{ filter: `blur(${blurPx}px)` }}>{children}</div>;
}
