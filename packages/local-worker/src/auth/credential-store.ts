// Local credential storage for the first-run login flow. See
// docs/design/first-run-auth-and-payment.md §5.
//
// Two things here are easy to get wrong and are handled explicitly:
//
// 1. fs.chmod is effectively a NO-OP on Windows — it toggles the read-only
//    bit and grants no per-user ACL. Writing 0o600 and calling it secured
//    would be a lie on a platform we actually ship (win32-x64 is a released
//    supervisor target). Windows gets an icacls pass that strips inheritance
//    and grants the current user only.
// 2. A crash mid-write must never leave a truncated credentials file, which
//    would log the user out and (worse) could half-persist a rotated refresh
//    token. Writes go to a temp file and are renamed into place, which is
//    atomic on both NTFS and POSIX filesystems.

import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms at which the access token expires. */
  expiresAt: number;
  /** AuthKit subject claim — used to detect an account switch. */
  subject: string;
}

export interface HardenResult {
  hardened: boolean;
  method: 'chmod' | 'icacls' | 'none';
  detail?: string;
}

/** Injected so tests never touch the real home directory or spawn icacls. */
export interface StoreDeps {
  baseDir: string;
  platform: NodeJS.Platform;
  /** Returns true if the command succeeded. */
  runCommand?: (cmd: string, args: string[]) => Promise<boolean>;
}

export function defaultBaseDir(): string {
  return join(homedir(), '.ocular');
}

function realRunCommand(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export function credentialsPath(deps: StoreDeps): string {
  return join(deps.baseDir, 'credentials.json');
}

/**
 * Restrict a file to its owner. Returns whether it actually succeeded rather
 * than throwing on Windows — a broken icacls should not lock a paying user
 * out of their own machine, but the caller MUST surface `hardened: false`
 * rather than assume the file is protected.
 */
export async function secureFile(path: string, deps: StoreDeps): Promise<HardenResult> {
  if (deps.platform === 'win32') {
    const user = process.env.USERNAME;
    if (!user) {
      return { hardened: false, method: 'none', detail: 'USERNAME not set; cannot scope an ACL' };
    }
    const run = deps.runCommand ?? realRunCommand;
    // /inheritance:r drops inherited ACEs (otherwise the parent's grants
    // survive); /grant:r replaces rather than adds, so the user ends up as
    // the only principal with access.
    const ok = await run('icacls', [path, '/inheritance:r', '/grant:r', `${user}:(R,W)`]);
    return ok
      ? { hardened: true, method: 'icacls' }
      : { hardened: false, method: 'icacls', detail: 'icacls returned a non-zero exit code' };
  }

  // POSIX: chmod is real and a failure here is genuinely exceptional, so it
  // propagates rather than being reported as a soft result.
  await chmod(path, 0o600);
  return { hardened: true, method: 'chmod' };
}

export async function loadCredentials(deps: StoreDeps): Promise<StoredCredentials | null> {
  let raw: string;
  try {
    raw = await readFile(credentialsPath(deps), 'utf8');
  } catch {
    // Absent file is the normal not-logged-in state, not an error.
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredCredentials(parsed) ? parsed : null;
  } catch {
    // Corrupt file is treated as logged-out. Re-running the login flow
    // overwrites it; failing hard here would strand the user with no path
    // back except deleting a file by hand.
    return null;
  }
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.accessToken === 'string' &&
    c.accessToken.length > 0 &&
    typeof c.refreshToken === 'string' &&
    c.refreshToken.length > 0 &&
    typeof c.expiresAt === 'number' &&
    Number.isFinite(c.expiresAt) &&
    typeof c.subject === 'string'
  );
}

export async function saveCredentials(
  credentials: StoredCredentials,
  deps: StoreDeps,
): Promise<HardenResult> {
  const path = credentialsPath(deps);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });

  // Unique temp name so two concurrent saves cannot clobber each other's
  // partial writes before the rename.
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(credentials, null, 2), { encoding: 'utf8', mode: 0o600 });

  // Harden the temp file BEFORE it becomes the real one, so the credentials
  // are never briefly readable at the final path.
  const hardened = await secureFile(tmp, deps);

  try {
    await rename(tmp, path);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }

  return hardened;
}

export async function clearCredentials(deps: StoreDeps): Promise<void> {
  await rm(credentialsPath(deps), { force: true });
}

/**
 * True when the access token is expired, or close enough that a request
 * started now could arrive after it expires.
 */
export function isExpired(credentials: StoredCredentials, nowMs: number, skewMs: number): boolean {
  return credentials.expiresAt - skewMs <= nowMs;
}
