// Persistent browser profile — directory lifecycle only in this phase.
// docs/rules/13-local-worker-and-distribution.md §5: authenticated-page
// login UX (the actual point of a *persistent* profile — staying logged
// into sites) is local-worker phase 2 of the PRD, scoped explicitly AFTER
// the unauthenticated local path is stable. This file just gives that
// future work a stable directory to land in; chrome-headless-shell is
// launched against this directory unconditionally today (an empty profile
// on first run, same as any fresh Chrome profile), not because auth is
// implemented.
//
// Also owns executable-path resolution — "detect and reuse an existing
// local Chromium, bundled fallback" is an explicit open decision (PRD v0.2
// §9 item 5) not yet made; OCULAR_HEADLESS_SHELL_PATH is a stand-in escape
// hatch for development and testing until that decision lands and a real
// installer exists.

import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export function resolveProfileDir(): string {
  const base =
    process.platform === 'win32'
      ? (process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'))
      : process.platform === 'darwin'
        ? path.join(homedir(), 'Library', 'Application Support')
        : (process.env.XDG_DATA_HOME ?? path.join(homedir(), '.local', 'share'));

  const dir = path.join(base, 'ocular', 'local-worker', 'profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export class HeadlessShellNotFoundError extends Error {
  constructor(searched: readonly string[]) {
    super(
      `Could not find a chrome-headless-shell executable. Set OCULAR_HEADLESS_SHELL_PATH explicitly, ` +
        `or install one at a detected location. Searched: ${searched.join(', ')}`,
    );
    this.name = 'HeadlessShellNotFoundError';
  }
}

function candidatePaths(): string[] {
  if (process.platform === 'win32') {
    return [
      path.join(
        homedir(),
        'AppData',
        'Local',
        'ocular',
        'headless-shell',
        'chrome-headless-shell.exe',
      ),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      path.join(
        homedir(),
        'Library',
        'Application Support',
        'ocular',
        'headless-shell',
        'chrome-headless-shell',
      ),
    ];
  }
  return [
    path.join(homedir(), '.local', 'share', 'ocular', 'headless-shell', 'chrome-headless-shell'),
  ];
}

export function resolveExecutablePath(): string {
  if (process.env.OCULAR_HEADLESS_SHELL_PATH) {
    return process.env.OCULAR_HEADLESS_SHELL_PATH;
  }

  const candidates = candidatePaths();
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;

  throw new HeadlessShellNotFoundError(candidates);
}
