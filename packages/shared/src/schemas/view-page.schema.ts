import { z } from 'zod';

/**
 * .url() is deliberate, not a bare z.string() — it's the first SSRF defense
 * layer, rejecting non-URL-shaped input before it reaches the SSRF pre-check.
 * See docs/rules/03-shared-contracts.md §2 and docs/rules/07-security.md §2.
 */
export const viewPageInputSchema = z.object({
  url: z.string().url(),
  detail: z.enum(['low', 'balanced', 'high']).default('balanced'),
  full_page: z.boolean().default(false),
  viewport: z
    .object({
      w: z.number().int().min(200).max(3840),
      h: z.number().int().min(200).max(2160),
    })
    .optional(),
});

export type ViewPageInput = z.infer<typeof viewPageInputSchema>;
