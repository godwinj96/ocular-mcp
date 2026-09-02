// Env var validation — see docs/rules/12-environment-and-secrets.md §2. Same
// fail-fast pattern as mcp-server/config.ts and worker/config.ts.
//
// NOTE: docs/rules/12-environment-and-secrets.md doesn't yet list
// local-worker's own env vars (a gap flagged during the PRD v0.2
// reconciliation pass) — these three are net-new and should be added there
// in the same PR that finalizes Phase 8 (routing/dual-surface integration),
// once the real install-time credential-issuance flow exists. For now they
// are placeholders a developer sets by hand for local testing.

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file — fine for local dev without cloud-path testing; only
  // required once OCULAR_API_KEY-backed forwarding is actually exercised.
}

export const config = {
  /** Deployed cloud mcp-server's MCP endpoint — where cloud-routed tool calls forward to. */
  cloudMcpUrl: process.env.OCULAR_CLOUD_MCP_URL ?? 'http://localhost:3000/mcp',
  /**
   * Static API key used both to authenticate cloud-routed captures and as
   * the subscription-validity signal (see src/subscription/validate.ts).
   * Phase 8 replaces manual placement here with a real install-time
   * credential-issuance flow (dashboard-issued, stored locally) — see
   * docs/rules/11-billing-and-quota.md §4 for the existing issuance
   * mechanism this will reuse.
   */
  apiKey: process.env.OCULAR_API_KEY,
  /** Comma-separated hostnames explicitly routed to the local path beyond localhost/private-IP. */
  localDomains: (process.env.OCULAR_LOCAL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'staging' | 'production',
} as const;
