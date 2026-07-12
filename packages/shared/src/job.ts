export type ToolName = 'view_page' | 'inspect_ui' | 'extract_assets' | 'get_quota';

export interface OcularJobAccount {
  id: string;
  plan: string;
}

/**
 * BullMQ job payload — the contract between mcp-server (producer) and worker
 * (consumer). See docs/rules/03-shared-contracts.md §3.
 */
export interface OcularJob<TInput = unknown> {
  tool: ToolName;
  /** Already Zod-validated by mcp-server before enqueue. */
  args: TInput;
  account: OcularJobAccount;
  /** uuid — used to correlate mcp-server and worker logs for this request. */
  requestId: string;
  /**
   * Absolute timestamp (Date.now() + JOB_DEADLINE_MS at enqueue time), NOT a
   * duration — see docs/rules/08-performance.md §1.
   */
  deadlineMs: number;
}
