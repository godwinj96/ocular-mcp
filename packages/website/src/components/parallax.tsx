import { useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Max vertical drift in px as the element crosses the viewport. Keep small — this is depth, not a scroll-jacking effect. */
  range?: number;
}

// Applied sparingly (2-3 spots sitewide, not uniformly) per the brand
// direction's "dramatic but tasteful" brief — everywhere would read as
// gimmicky rather than as depth.
export function Parallax({ children, className, range = 24 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [-range, range]);

  if (reduceMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
