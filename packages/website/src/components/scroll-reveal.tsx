import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Real scroll-driven choreography per research & planning/06-brand-identity.md
// §6.4 (Round 2) — every bento cell gets a staggered entrance, not just the
// hero. prefers-reduced-motion collapses this to a no-op (content renders
// immediately, no animation), per WCAG 2.3.3.
interface ScrollRevealProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

const STAGGER_MS = 80;

export function ScrollReveal({ children, index = 0, className }: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: (index * STAGGER_MS) / 1000 }}
    >
      {children}
    </motion.div>
  );
}
