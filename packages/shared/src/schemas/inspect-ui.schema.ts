import { z } from 'zod';
import { viewPageInputSchema } from './view-page.schema.js';

export const inspectUiInputSchema = viewPageInputSchema.omit({ full_page: true });

export type InspectUiInput = z.infer<typeof inspectUiInputSchema>;
