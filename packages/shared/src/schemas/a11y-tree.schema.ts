import { z } from 'zod';

/**
 * Accessibility tree shipped alongside every screenshot (view_page/inspect_ui,
 * both cloud and local paths) — Set-of-Mark style viewport-position
 * annotation. docs/rules/05-worker-and-browser-pipeline.md §4a.
 *
 * HARD RULE: annotate, never filter. A node's `inView`/`coords` describe
 * where it sits, they never gate whether it's included — truncating this
 * tree to the viewport throws away its entire advantage over the screenshot
 * (below-fold content the image can't show). Size discipline comes from
 * `maxNodes`/`truncated` below, never from viewport clipping.
 */
export interface A11yNode {
  role: string;
  name?: string;
  inView: boolean;
  coords: { x: number; y: number; w: number; h: number };
  /** Always present (empty array for a leaf) — extractors must not omit this field. */
  children: A11yNode[];
}

// Explicit ZodType annotation + `as` cast is the standard escape hatch for a
// self-referential Zod schema (z.lazy can't infer its own recursive type).
// children is required (not `.default([])`) specifically so the input and
// output types match exactly — a default here would make TS infer an
// optional-input/required-output mismatch against the ZodType<A11yNode>
// annotation.
export const a11yNodeSchema: z.ZodType<A11yNode> = z.object({
  role: z.string(),
  name: z.string().optional(),
  /** In-viewport at capture time. false includes below-fold content — see the hard rule above. */
  inView: z.boolean(),
  /** Page coordinates (not viewport-relative) so below-fold nodes still have a meaningful position. */
  coords: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  children: z.lazy(() => a11yNodeSchema.array()),
}) as z.ZodType<A11yNode>;

export const a11yTreeSchema = z.object({
  root: a11yNodeSchema,
  /** True if the walk hit the extractor's size cap — see docs/rules/07-security.md §6 (hard cap on output size). */
  truncated: z.boolean(),
  nodeCount: z.number().int().nonnegative(),
});

export type A11yTree = z.infer<typeof a11yTreeSchema>;
