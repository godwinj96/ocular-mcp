import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Next.js regenerates next-env.d.ts on every build and owns its contents;
    // the triple-slash references are Next's, not ours, and editing them is
    // undone by the next build. Linting a generated file we cannot fix is
    // pure noise.
    ignores: ['**/next-env.d.ts'],
  },
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
    // .mjs scripts are the same story as .cjs above — they run directly under
    // Node and need its globals (process/Buffer/console). They are ESM, so
    // unlike .cjs they get no require() exemption.
    //
    // Their absence here is why `npx eslint .` reported 18 no-undef errors
    // across kpi-probe.mjs and capture-motion-specimen.mjs: a config gap, not
    // broken code.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // React hook correctness for the two React surfaces (website is a Vite
    // SPA, dashboard is Next.js). Owed since Session 31, when two hooks'
    // eslint-disable directives had to be downgraded to plain comments
    // because they named a rule ESLint could not resolve — which failed the
    // whole lint run rather than just those lines.
    files: ['packages/website/**/*.{ts,tsx}', 'packages/dashboard/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
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
