'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Gates a demo's CSS loop on visibility. Pair the returned ref with the
 * `demo-loop` class and toggle `is-live` from `inView` — tokens.css keeps
 * every animation inside a paused `.demo-loop` until that class lands.
 *
 * Deliberately NOT a one-shot reveal: the loops resume when the section comes
 * back into view. A once-per-element entrance transition is precisely the
 * "that's a transition, not an animation" failure this round exists to fix.
 */
export function useInView<T extends HTMLElement>(): {
  ref: React.RefObject<T>;
  inView: boolean;
} {
  const ref = useRef<T>(null);
  // Lazy initial state rather than an effect that flips it. Whether
  // IntersectionObserver exists is a static capability of the environment, not
  // something that changes at runtime, so the no-observer fallback ("assume
  // everything is visible") is the correct INITIAL value — not a correction
  // applied one render later. Setting it inside the effect was a
  // setState-synchronously-in-an-effect cascading render.
  const [inView, setInView] = useState(() => typeof IntersectionObserver !== 'function');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
