#!/usr/bin/env node
// Runs eslint --fix then prettier --write on the given files. Spawns both
// tools' real entry points directly via `node <entry> <args>` — no `npx`,
// no shell — because `npx ... --shell:true` on Windows wraps the whole
// command in an outer pair of quotes while per-arg quoting (needed for
// paths like "research & planning/...") adds inner quotes, and cmd.exe's
// parser mishandles that nested quoting specifically when `&` appears
// inside the inner quotes (confirmed: ETIMEDOUT hangs, reproducible only
// with that exact directory name). Spawning the real JS entry point with
// no shell involved sidesteps cmd.exe's parser entirely — argv reaches the
// process exactly as given, regardless of spaces or special characters.
'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin/eslint.js');
const prettierBin = require.resolve('prettier/bin/prettier.cjs');

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

execFileSync(process.execPath, [eslintBin, '--fix', ...files], { stdio: 'inherit' });
execFileSync(process.execPath, [prettierBin, '--write', ...files], { stdio: 'inherit' });
