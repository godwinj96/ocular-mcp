import { z } from 'zod';

export const extractAssetsInputSchema = z.object({
  url: z.string().url(),
  include: z.array(z.enum(['svg', 'img', 'icons'])).default(['svg', 'img', 'icons']),
});

export type ExtractAssetsInput = z.infer<typeof extractAssetsInputSchema>;
