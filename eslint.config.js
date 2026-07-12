import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
