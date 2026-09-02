#!/usr/bin/env node
// Cross-platform wrapper around `go build` for the supervisor binary.
// Windows MUST use -ldflags="-H windowsgui" (see supervisor/main.go's own
// build note and docs/rules/13-local-worker-and-distribution.md §4) — a
// bare `go build` on Windows produces a console app that flashes a window
// on launch. This script exists specifically so that flag can never be
// forgotten by someone running `npm run build` without knowing the rule.
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const supervisorDir = path.join(__dirname, '..', 'supervisor');
const outDir = path.join(__dirname, '..', 'dist-supervisor');
const isWindows = process.platform === 'win32';

const outPath = path.join(outDir, isWindows ? 'ocular-supervisor.exe' : 'ocular-supervisor');
const args = ['build', '-o', outPath, '.'];
if (isWindows) {
  args.splice(1, 0, '-ldflags=-H windowsgui');
}

const result = spawnSync('go', args, { cwd: supervisorDir, stdio: 'inherit' });

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.error(
      '[local-worker] `go` was not found on PATH. Install Go (https://go.dev/dl/) before building the supervisor.',
    );
  } else {
    console.error('[local-worker] failed to run `go build`:', result.error.message);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
