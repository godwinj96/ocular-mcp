import { inspectUiInputSchema } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { enqueueAndAwait } from '../queue/enqueue.js';
import type { ToolRequestContext } from './view-page.js';

export async function handleInspectUi(rawArgs: unknown, ctx: ToolRequestContext): Promise<ResultEnvelope> {
  const args = inspectUiInputSchema.parse(rawArgs);
  return enqueueAndAwait({ tool: 'inspect_ui', args, account: ctx.account, requestId: ctx.requestId });
}
