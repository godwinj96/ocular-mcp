import { z } from 'zod';

/**
 * get_tree — the full accessibility tree for a page, including everything
 * below the fold.
 *
 * WHY THIS TOOL EXISTS. view_page and inspect_ui ship in-viewport nodes in full
 * plus an outline of what lies past the fold (see a11y-tree.schema.ts for the
 * amended rule and the measurement that forced it). That is the right default:
 * it is what the screenshot shows, plus enough to know what it doesn't. When an
 * agent needs the rest — reading a long document, auditing a page it cannot
 * scroll, checking a footer it has only been told exists — this is where it
 * goes, and it is deliberately a separate call so the common case does not pay
 * for the rare one.
 *
 * The response carries no image. This tool answers a structural question, and
 * a screenshot the caller already has would just be spending its budget twice.
 */
export const getTreeInputSchema = z.object({
  url: z.string().url(),

  /**
   * Where to start. Omitted, the whole page; given a y offset in page
   * coordinates, only the subtree below it — which is how a caller pages
   * through a very long document without asking for all of it at once. The
   * outline's `headings[].y` values are exactly the offsets to pass here.
   */
  from_y: z.number().nonnegative().optional(),

  /**
   * Cap on returned nodes. The extractor's own hard cap still applies on top of
   * this; this is the caller asking for less, never for more.
   */
  limit: z.number().int().min(1).max(5000).default(1500),

  viewport: z
    .object({
      w: z.number().int().min(200).max(3840),
      h: z.number().int().min(200).max(2160),
    })
    .optional(),

  /** Same force-refresh contract every capture tool exposes. */
  fresh: z.boolean().default(false),
});

export type GetTreeInput = z.infer<typeof getTreeInputSchema>;
