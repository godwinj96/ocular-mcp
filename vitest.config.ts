import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // mcp-server/worker/shared keep source under src/; dashboard is a
    // Next.js package (app/ + lib/ at the package root, no src/) — its
    // tests live under lib/ instead.
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/dashboard/lib/**/*.test.ts',
      'packages/motion/test/**/*.test.ts',
    ],
    setupFiles: ['packages/dashboard/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'packages/*/src/**/*.ts',
        'packages/dashboard/lib/**/*.ts',
        'packages/motion/src/**/*.ts',
      ],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/dashboard/lib/**/*.test.ts',
        'packages/motion/test/**/*.test.ts',
        '**/dist/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
