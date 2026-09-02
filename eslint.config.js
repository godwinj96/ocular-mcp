import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // .cjs build/lifecycle scripts run directly under Node, not bundled —
    // they need Node globals (require/process/__dirname/console) and CJS
    // require() is the correct form here, not an ESM violation.
    files: ['**/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // local-worker must never import packages/worker's cloud-only surface
    // (ladder/routing-memory/providers/cloud-cache) — the two paths share
    // only through @ocular/shared. docs/rules/13-local-worker-and-distribution.md §1/§7.
    files: ['packages/local-worker/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ocular/worker', '@ocular/worker/*', '**/packages/worker/**'],
              message:
                'local-worker must never import packages/worker — the two execution paths share only through @ocular/shared (docs/rules/13-local-worker-and-distribution.md §1/§7).',
            },
          ],
        },
      ],
    },
  },
  {
    // packages/shared must stay near-zero-dependency — see docs/rules/03-shared-contracts.md §5
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'ioredis',
              message:
                'packages/shared must have zero runtime deps beyond zod (docs/rules/03-shared-contracts.md §5).',
            },
            { name: 'bullmq', message: 'packages/shared must have zero runtime deps beyond zod.' },
            { name: 'fastify', message: 'packages/shared must have zero runtime deps beyond zod.' },
            {
              name: 'patchright',
              message: 'packages/shared must have zero runtime deps beyond zod.',
            },
            { name: 'next', message: 'packages/shared must have zero runtime deps beyond zod.' },
          ],
        },
      ],
    },
  },
  {
    // Only self-hosted-provider.ts may import patchright — see docs/rules/01-architecture.md §3
    files: ['packages/worker/**/*.ts'],
    ignores: ['packages/worker/src/providers/self-hosted-provider.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'patchright',
              message:
                'Only packages/worker/src/providers/self-hosted-provider.ts may import patchright directly — route through BrowserProvider (docs/rules/01-architecture.md §3).',
            },
          ],
        },
      ],
    },
  },
);
