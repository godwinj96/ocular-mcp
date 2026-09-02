#!/usr/bin/env node
// Bundles src/main.ts into a single dist/main.js via esbuild, inlining
// @ocular/shared (workspace-resolved in the monorepo, but a published
// tarball has no workspace to resolve it from) while keeping real npm
// dependencies (@modelcontextprotocol/sdk, pino, sharp) external — sharp in
// particular ships native bindings that must stay a real installed
// dependency, not something a bundler can inline.
// See docs/rules/13-local-worker-and-distribution.md §8.
'use strict';

const esbuild = require('esbuild');
const path = require('node:path');

const pkgRoot = path.join(__dirname, '..');

esbuild
  .build({
    entryPoints: [path.join(pkgRoot, 'src/main.ts')],
    outfile: path.join(pkgRoot, 'dist/main.js'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', '@modelcontextprotocol/sdk/*', 'pino', 'sharp'],
    logLevel: 'info',
  })
  .catch((error) => {
    console.error('[local-worker] esbuild bundle failed:', error);
    process.exit(1);
  });
