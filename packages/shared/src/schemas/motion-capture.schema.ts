import { z } from 'zod';

/**
 * Motion/animation verification tool — the 5th MCP tool, both cloud and
 * local paths. docs/rules/05-worker-and-browser-pipeline.md §4b.
 *
 * Claude accepts no video input and reads animated GIFs first-frame-only —
 * motion always ships as discrete still images, never a video/GIF blob.
 */
export const motionCaptureInputSchema = z.object({
  url: z.string().url(),
  /**
   * verification (default): cheap, diff-triggered sampling delivered as one
   * tiled contact sheet — "is the stagger/easing/overshoot roughly right."
   * analysis (opt-in, costlier): fixed high-fps, full-size untiled frames,
   * for precise timing measurement. Undersampling invents artifacts — see
   * docs/rules/05-worker-and-browser-pipeline.md §4b's documented false
   * "scale-pop" reading from a 5fps pass on a real 0%-overshoot animation.
   */
  mode: z.enum(['verification', 'analysis']).default('verification'),
  /**
   * Perceptual diffing breaks under scroll (scrolling changes nearly every
   * pixel regardless of the animation) — scroll-driven content needs a
   * different sampling axis entirely.
   *   time: normal time-based sampling (the default, for non-scroll motion).
   *   scroll-scrubbed: sample by scroll-position increment (parallax,
   *     pinned/sticky sections, scroll-timeline-driven animation).
   *   scroll-triggered: scroll to the trigger point, hold, then apply
   *     time-based burst capture (animation fires once past a threshold,
   *     then runs on its own clock).
   */
  scrollSampling: z.enum(['time', 'scroll-scrubbed', 'scroll-triggered']).default('time'),
  /** analysis mode only — sampling rate; ignored in verification mode. */
  fps: z.number().int().min(1).max(60).default(24),
  /** verification mode only — perceptual-diff threshold that triggers a sampled frame. */
  diffThreshold: z.number().min(0).max(1).default(0.05),
  fresh: z.boolean().default(false),
});

export type MotionCaptureInput = z.infer<typeof motionCaptureInputSchema>;

const motionFrameSchema = z.object({
  /** Milliseconds since capture start (verification: since the diff-trigger window began). */
  tMs: z.number().nonnegative(),
  /** Scroll offset in px at capture time — only meaningful for scroll-sampled captures. */
  scrollY: z.number().optional(),
  b64: z.string(),
  mime: z.literal('image/webp'),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const motionCaptureOutputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('verification'),
    /** One tiled image — one image's token cost, per docs/rules/05 §4b. */
    contactSheet: z.object({
      b64: z.string(),
      mime: z.literal('image/webp'),
      w: z.number().int().positive(),
      h: z.number().int().positive(),
      bytes: z.number().int().positive(),
      /** Frame timestamps/scroll-offsets in tile order, for correlating a tile back to a moment. */
      tiles: z.array(z.object({ tMs: z.number().nonnegative(), scrollY: z.number().optional() })),
    }),
  }),
  z.object({
    mode: z.literal('analysis'),
    frames: z.array(motionFrameSchema),
  }),
]);

export type MotionCaptureOutput = z.infer<typeof motionCaptureOutputSchema>;
