// See docs/rules/02-repo-structure.md §6 bootstrap template and
// docs/rules/04-mcp-server-and-auth.md §3 for the full per-request pipeline
// (SSRF precheck + quota check run in mcp/server.ts before this is called).

import { viewPageInputSchema } from '@ocular/shared';
import type { OcularJobAccount, ResultEnvelope } from '@ocular/shared';
import { enqueueAndAwait } from '../queue/enqueue.js';

export interface ToolRequestContext {
  account: OcularJobAccount;
  requestId: string;
}

export async function handleViewPage(rawArgs: unknown, ctx: ToolRequestContext): Promise<ResultEnvelope> {
  const args = viewPageInputSchema.parse(rawArgs);
  return enqueueAndAwait({ tool: 'view_page', args, account: ctx.account, requestId: ctx.requestId });
}
