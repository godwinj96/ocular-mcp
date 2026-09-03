import { useEffect, useState } from 'react';

/**
 * Replaces framer-motion's useReducedMotion, which after round 5 was the only
 * thing the library was still imported for — ~34KB gzip for one media query.
 * Removing it is the "must not be heavier than the product it sells"
 * constraint made concrete.
 *
 * Initialised from a function so the first render already has the correct
 * value; matchMedia is guarded for any non-browser render path.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
