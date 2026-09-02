import type { ReactNode } from 'react';

interface MotionCtaProps {
  href: string;
  className?: string;
  children: ReactNode;
}

// Reduced to a plain anchor. This previously applied a framer-motion spring
// scale on tap, which the Instrument concept rules out — "nothing else
// animates beyond default hover states." The spec'd interaction is a 1px lift
// and a literal colour swap, both of which are plain CSS supplied by the call
// site's className, so there is nothing left here that an <a> can't do.
//
// Kept as a component rather than deleted outright only because several call
// sites still route through it; it is a seam, not behaviour. Fold it into the
// call sites next time one of them is touched.
export function MotionCta({ href, className, children }: MotionCtaProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
