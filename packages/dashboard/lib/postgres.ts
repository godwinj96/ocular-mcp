// @neondatabase/serverless — HTTP-based driver, correct for short-lived
// Vercel serverless functions (see docs/rules/02-repo-structure.md §8's
// "two different Postgres drivers, deliberately" rule). mcp-server uses
// pg/TCP-pool instead because it's a long-lived process; never share a
// driver instance across packages.
import { neon } from '@neondatabase/serverless';

if (!process.env.POSTGRES_URL) {
  throw new Error('Missing required env var: POSTGRES_URL. Check your .env file.');
}

export const sql = neon(process.env.POSTGRES_URL);
