'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Fits a fixed-width design into whatever width its container happens to be,
 * returning the scale factor for a `transform: scale()`.
 *
 * The pure-CSS version of this — `transform: scale(calc(100cqw / 1440))` —
 * looks right and silently does nothing: dividing a length by a number yields
 * a length, `scale()` needs a unitless number, so the whole declaration is
 * invalid and dropped. The specimen then renders at 1:1 and is cropped rather
 * than fitted, which is exactly what it did on first build.
 *
 * useLayoutEffect, not useEffect: the first measurement has to land before
 * paint or the specimen is briefly visible at full size inside the frame.
 */
export function useFitScale<T extends HTMLElement>(designWidth: number) {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (width: number) => setScale(width / designWidth);
    measure(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [designWidth]);

  return { ref, scale };
}
