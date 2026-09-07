// Env var validation — see docs/rules/12-environment-and-secrets.md §2.
// Fails loudly at process startup rather than surfacing as a confusing
// runtime error three requests later.

try {
  // Resolved relative to this file, not process.cwd() — cwd varies depending
  // on whether this runs via `npm run dev --workspace=...` or the root-level
  // `vitest run`, but packages/mcp-server/.env's location is fixed.
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file — expected in staging/production, where vars are injected by
  // the deployment mechanism instead (docs/rules/12-environment-and-secrets.md §3).
}

// REDIS_URL (queue/quota) and POSTGRES_URL (account/plan resolution) are now
// required — both backing services exist and are confirmed live (see DEVLOG
// M0). Per docs/rules/12-environment-and-secrets.md §2.
const required = [
  'MCP_SERVER_PORT',
  'AUTHKIT_ISSUER_URL',
  'AUTHKIT_RESOURCE_IDENTIFIER',
  'AUTHKIT_JWKS_CACHE_TTL_S',
  'REDIS_URL',
  'POSTGRES_URL',
  'DASHBOARD_INTERNAL_URL',
  'INTERNAL_SERVICE_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Check your .env file.`);
  }
}

// Optional — MCP clients (Claude Desktop, agents, curl) never send an Origin
// header at all, only a browser context does. Per the MCP spec's Streamable
// HTTP transport security guidance (DNS-rebinding defense), an Origin header
// is only ever legitimate here if it's from Ocular's own dashboard/website;
// default empty means "reject any request that carries an Origin header,"
// which is correct until there's an actual browser-based caller to allow.
const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const config = {
  port: Number(process.env.MCP_SERVER_PORT),
  authkitIssuerUrl: process.env.AUTHKIT_ISSUER_URL!,
  authkitResourceIdentifier: process.env.AUTHKIT_RESOURCE_IDENTIFIER!,
  authkitJwksCacheTtlS: Number(process.env.AUTHKIT_JWKS_CACHE_TTL_S),
  redisUrl: process.env.REDIS_URL!,
  postgresUrl: process.env.POSTGRES_URL!,
  // Where /worker/heartbeat forwards to. The dashboard owns the workers,
  // capture_counters, and audit_events tables — see
  // docs/rules/02-repo-structure.md §0.6. Not the public dashboard URL a
  // browser would use; a deployment-internal address is fine (and preferred)
  // once one exists.
  dashboardInternalUrl: process.env.DASHBOARD_INTERNAL_URL!,
  // Shared secret between mcp-server and the dashboard's /api/internal/*
  // routes — proves the caller is mcp-server, not the end user's own bearer
  // token verified a second time. mcp-server already verified the caller
  // once via resolveAccount() before this is ever used.
  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET!,
  allowedOrigins,
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'staging' | 'production',
  isProd: process.env.NODE_ENV === 'production',
} as const;

if (
  config.isProd &&
  !config.postgresUrl.startsWith('postgres://') &&
  !config.postgresUrl.startsWith('postgresql://')
) {
  throw new Error('Production POSTGRES_URL must be a valid postgres connection string');
}
