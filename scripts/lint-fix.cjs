#!/usr/bin/env node
// Runs eslint --fix then prettier --write on the given files, both from
// inside this single process. Exists because lint-staged spawning eslint
// and prettier as two SEQUENTIAL child processes for the same glob hangs
// indefinitely in this environment (reproduced 3/3 times, with both the
// package.json array form and an external config file's array-returning
// function — a single command per glob never hung). Routing both tools
// through one wrapper process keeps lint-staged's own spawn count at one
// per glob while still running both tools.
'use strict';

const { execFileSync } = require('node:child_process');

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

execFileSync('npx', ['eslint', '--fix', ...files], { stdio: 'inherit', shell: true });
execFileSync('npx', ['prettier', '--write', ...files], { stdio: 'inherit', shell: true });
