import type { RevealProps } from './types.js';

// Reveal Grammar — Disclosure class (§II.10 rule 1). "The world is larger
// than the current view; perception travels." Camera motion brings an
// already-present subject into frame. Per §II.10's own Engineering
// Abstraction: "Disclosure is implemented as an AttentionTarget declaration
// to the ObserverCamera rather than a local animation" — so this component
// renders no animation of its own. The actual motion is declared as an
// AttentionTarget passed to <ObserverCamera targets={...}> at the
// composition/plan level; Disclosure exists as a semantic marker so a
// scene's reveal-class choice stays legible in the plan (Emergence vs.
// Resolution vs. Assembly vs. Disclosure), not as a functional wrapper.

export function Disclosure({ children }: Pick<RevealProps, 'children'>) {
  return <>{children}</>;
}
