import { z } from 'zod';

/**
 * Accessibility tree shipped alongside every screenshot (view_page/inspect_ui,
 * both cloud and local paths) — Set-of-Mark style viewport-position
 * annotation. docs/rules/05-worker-and-browser-pipeline.md §4a.
 *
 * THE RULE, AS AMENDED 2026-09-07. It used to read: "annotate, never filter …
 * truncating this tree to the viewport throws away its entire advantage over
 * the screenshot". The reasoning was right and the implementation was
 * unaffordable. Measured against this project's own marketing page, a full
 * walk serialises to ~107KB — about 27k tokens, which overran a real client's
 * response budget and got the payload truncated at the transport layer. A tree
 * the caller never receives annotates nothing.
 *
 * The amended rule keeps the guarantee and drops the cost:
 *
 *   - IN-VIEWPORT nodes ship in full, exactly as before: role, name,
 *     coordinates, nesting.
 *   - BELOW-FOLD content ships as `outline` — every heading and landmark with
 *     its position, plus a count of what else is down there by role. The
 *     screenshot still stops at the fold and the tree still does not.
 *   - The complete below-fold detail remains available on demand via the
 *     `get_tree` tool. Nothing is destroyed; the default response is scoped.
 *
 * What is still forbidden, and this is the part that carried the original
 * rule's weight: silently omitting below-fold content altogether. A reader must
 * always be able to tell that something exists past the fold, what kind of
 * thing it is, and how to go and read it.
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
  /** In-viewport at capture time. See the amended rule above for what ships by default. */
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

/**
 * What lies past the fold, cheaply.
 *
 * Headings and landmarks are listed individually because they are how a reader
 * navigates a page they cannot see — they answer "what sections are down
 * there". Everything else is counted by role, which answers "how much, and of
 * what kind" without paying per-node geometry for content nobody has asked to
 * look at yet.
 */
export const a11yOutlineSchema = z.object({
  /** How many nodes exist below the fold that are not detailed in `root`. */
  nodeCount: z.number().int().nonnegative(),
  /** Every below-fold heading, in document order, with its page position. */
  headings: z
    .object({
      role: z.string(),
      name: z.string(),
      y: z.number(),
    })
    .array(),
  /** Below-fold landmarks (nav, main, banner, contentinfo, form, table, list). */
  landmarks: z
    .object({
      role: z.string(),
      name: z.string().optional(),
      y: z.number(),
    })
    .array(),
  /** Everything else below the fold, tallied by role. */
  countsByRole: z.record(z.string(), z.number().int().nonnegative()),
});

export type A11yOutline = z.infer<typeof a11yOutlineSchema>;

export const a11yTreeSchema = z.object({
  root: a11yNodeSchema,
  /**
   * Present whenever the page extends past the fold. Absent means there is
   * genuinely nothing below it — never "we decided not to say".
   */
  outline: a11yOutlineSchema.optional(),
  /** True if the walk hit the extractor's size cap — see docs/rules/07-security.md §6 (hard cap on output size). */
  truncated: z.boolean(),
  nodeCount: z.number().int().nonnegative(),
  /**
   * How to read the rest. Set whenever `outline` is, so a caller never has to
   * already know that `get_tree` exists to discover the page continues.
   */
  more: z.string().optional(),
});

export type A11yTree = z.infer<typeof a11yTreeSchema>;
