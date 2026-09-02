#!/usr/bin/env node
// Runs prettier --write on the given files. See lint-fix.cjs's header
// comment for why this spawns prettier's real entry point directly (node
// <entry> <args>, no npx, no shell) instead of going through npx.
'use strict';

const { execFileSync } = require('node:child_process');

const prettierBin = require.resolve('prettier/bin/prettier.cjs');

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

execFileSync(process.execPath, [prettierBin, '--write', ...files], { stdio: 'inherit' });
