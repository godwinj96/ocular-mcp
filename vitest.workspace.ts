import { defineWorkspace } from 'vitest/config';

// Two projects, deliberately split on ONE axis: which of them is allowed to
// load packages/dashboard/.env.
//
// This file exists because of a real, costly bug. The root config used to set
// `setupFiles: ['packages/dashboard/vitest.setup.ts']`, and setupFiles is
// global to the whole workspace run — not scoped to the package that owns the
// file. That setup file calls process.loadEnvFile() before any test module
// graph evaluates, so it populated REDIS_URL process-wide. Because
// process.loadEnvFile follows --env-file semantics and never overwrites an
// already-set variable, the dashboard value won every race and each other
// package's own correct .env silently became a no-op. One stale host in
// packages/dashboard/.env therefore failed 9 tests in `worker` and
// `mcp-server` — packages that neither import it nor reference it — and read
// as flaky Redis connectivity for several sessions.
//
// Keep the setup file on the dashboard project only. Anything that needs
// env for another package belongs in that package's own .env.
export default defineWorkspace([
  {
    test: {
      name: 'dashboard',
      // Next.js package: app/ + lib/ at the package root, no src/.
      include: ['packages/dashboard/lib/**/*.test.ts'],
      // Scoped here on purpose. Do not hoist this to the root config.
      setupFiles: ['packages/dashboard/vitest.setup.ts'],
    },
  },
  {
    test: {
      name: 'packages',
      // mcp-server/worker/shared/local-worker keep source under src/;
      // motion keeps its tests under test/.
      include: ['packages/*/src/**/*.test.ts', 'packages/motion/test/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      // No setupFiles. Each package loads its own .env through its own
      // config module.
    },
  },
]);
