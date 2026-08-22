import type { DurationToken } from '../../tokens/temporal.js';

// §IV.16 rule 9 — all four reveal classes share one interface, so class is
// swappable without refactor.
export type RevealProps = {
  entryFrame: number;
  duration: DurationToken;
  children: React.ReactNode;
};
