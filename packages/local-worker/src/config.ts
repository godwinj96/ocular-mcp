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
   * DEPRECATED — the legacy static API key.
   *
   * The replacement has landed: src/auth/ implements the PKCE login flow from
   * docs/design/first-run-auth-and-payment.md, and src/auth/bearer.ts prefers
   * stored OAuth credentials over this value. It is still read so that anyone
   * mid-migration keeps working (the cloud server's resolveAccount() accepts
   * both), and it is removed at design §7 step 2.
   *
   * Read it through createBearerResolver(), never directly. A second direct
   * read is exactly how subscription/validate.ts ended up with its own
   * duplicate source of truth.
   */
  apiKey: process.env.OCULAR_API_KEY,
  /** WorkOS AuthKit public client id. Public by design — a PKCE client holds no secret. */
  authClientId: process.env.OCULAR_AUTH_CLIENT_ID ?? '',
  /**
   * Dashboard route that orchestrates sign-in -> subscription check ->
   * checkout -> AuthKit bounce, so payment happens in the same browser visit
   * (design §4.2). The local worker opens this, not AuthKit directly.
   */
  connectUrl: process.env.OCULAR_CONNECT_URL ?? 'https://app.useocular.com/connect',
  /** Comma-separated hostnames explicitly routed to the local path beyond localhost/private-IP. */
  localDomains: (process.env.OCULAR_LOCAL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'staging' | 'production',
} as const;
