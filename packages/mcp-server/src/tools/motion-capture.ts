import { motionCaptureInputSchema } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
import { enqueueAndAwait } from '../queue/enqueue.js';
import type { ToolRequestContext } from './view-page.js';

export async function handleMotionCapture(
  rawArgs: unknown,
  ctx: ToolRequestContext,
): Promise<ResultEnvelope> {
  const args = motionCaptureInputSchema.parse(rawArgs);
  return enqueueAndAwait({
    tool: 'motion_capture',
    args,
    account: ctx.account,
    requestId: ctx.requestId,
  });
}
