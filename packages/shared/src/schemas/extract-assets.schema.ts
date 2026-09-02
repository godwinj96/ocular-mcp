import { z } from 'zod';

export const extractAssetsInputSchema = z.object({
  url: z.string().url(),
  include: z.array(z.enum(['svg', 'img', 'icons'])).default(['svg', 'img', 'icons']),
  /** See view-page.schema.ts's `fresh` field — same cache-bypass contract. */
  fresh: z.boolean().default(false),
});

export type ExtractAssetsInput = z.infer<typeof extractAssetsInputSchema>;
