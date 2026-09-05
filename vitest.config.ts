import { defineConfig } from 'vitest/config';

// Test discovery and setup now live in vitest.workspace.ts, which splits the
// run into a `dashboard` project and a `packages` project so that dashboard's
// env-loading setup file cannot leak process-wide env into unrelated packages.
// Read the comment there before moving anything back up here.
//
// Coverage is a root-level option in Vitest 2 and stays in this file.
export default defineConfig({
  test: {
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
