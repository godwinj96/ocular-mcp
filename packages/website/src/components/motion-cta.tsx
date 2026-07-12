import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionTokens, springs } from '../lib/motion-tokens.js';

interface MotionCtaProps {
  href: string;
  className: string;
  children: ReactNode;
}

// Shared spring press/pop feedback for every "Connect Ocular" CTA — the
// gradient-hairline BentoCells already had hover-lift via CSS; the anchor
// buttons themselves had none beyond a brightness tween. Reduced motion
// disables the transform, keeping only the existing CSS brightness hover.
export function MotionCta({ href, className, children }: MotionCtaProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      href={href}
      className={className}
      whileHover={reduceMotion ? undefined : { scale: motionTokens.scale.pop }}
      whileTap={reduceMotion ? undefined : { scale: motionTokens.scale.press }}
      transition={springs.snappy}
    >
      {children}
    </motion.a>
  );
}
