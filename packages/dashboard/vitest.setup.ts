// Runs once before each dashboard test file's module graph is evaluated
// (vitest setupFiles execute before the test file's own imports resolve —
// unlike a same-file top-level statement, which ES module import hoisting
// would run *after* anyway). Dashboard's lib/postgres.ts and
// lib/quota-reader.ts read process.env directly and throw at import time if
// unset; in the real app Next.js loads packages/dashboard/.env
// automatically before any module executes, but a standalone `vitest run`
// has no Next.js runtime to do that, so it's loaded explicitly here —
// mirroring the guarded process.loadEnvFile pattern already used by
// packages/mcp-server/src/config.ts.
try {
  process.loadEnvFile(new URL('./.env', import.meta.url));
} catch {
  // No .env file — expected in CI, where vars are injected by the runner.
}
