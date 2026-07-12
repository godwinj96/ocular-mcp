// Shared Postgres connection pool (Neon). See docs/rules/02-repo-structure.md
// §8 — mcp-server uses `pg` (long-lived process), unlike `dashboard`'s
// `@neondatabase/serverless` (short-lived serverless functions).

import { Pool } from 'pg';
import { config } from '../config.js';

// Factory (not a bare module-scope singleton) so tests can point queries at a
// disposable pool instead of the shared dev database — same pattern as
// verify-authkit-token.ts's createAuthKitVerifier.
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export const pool = createPool(config.postgresUrl);
