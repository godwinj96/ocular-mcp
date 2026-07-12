import { motion, useReducedMotion, useScroll } from 'framer-motion';

// Thin top-of-viewport progress bar — subtle wayfinding for a longer page,
// not decorative. Disabled under reduced motion (a static bar would just be
// visual noise with no information value once it can't track scroll).
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="fixed left-0 top-0 z-[60] h-[2px] w-full origin-left bg-accent"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
