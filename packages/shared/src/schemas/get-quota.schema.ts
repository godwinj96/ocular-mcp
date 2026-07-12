import { z } from 'zod';

/** No args — kept as a schema (not just `{}`) for consistency with the other tools. */
export const getQuotaInputSchema = z.object({});

export type GetQuotaInput = z.infer<typeof getQuotaInputSchema>;
