import { extractAssetsInputSchema } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { enqueueAndAwait } from '../queue/enqueue.js';
import type { ToolRequestContext } from './view-page.js';

export async function handleExtractAssets(rawArgs: unknown, ctx: ToolRequestContext): Promise<ResultEnvelope> {
  const args = extractAssetsInputSchema.parse(rawArgs);
  return enqueueAndAwait({ tool: 'extract_assets', args, account: ctx.account, requestId: ctx.requestId });
}
