// Env var validation — see docs/rules/12-environment-and-secrets.md §2.
// Same fail-fast pattern as packages/mcp-server/src/config.ts.

try {
  // Resolved relative to this file, not process.cwd() — see the identical
  // note in mcp-server/src/config.ts.
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file — expected in staging/production, where vars are injected
  // by the deployment mechanism instead.
}

const required = ['REDIS_URL'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Check your .env file.`);
  }
}

export const config = {
  redisUrl: process.env.REDIS_URL!,
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'staging' | 'production',
  isProd: process.env.NODE_ENV === 'production',
} as const;
