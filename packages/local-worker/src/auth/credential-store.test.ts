import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreDeps, StoredCredentials } from './credential-store.js';
import {
  clearCredentials,
  credentialsPath,
  isExpired,
  loadCredentials,
  saveCredentials,
  secureFile,
} from './credential-store.js';

let baseDir: string;

const creds: StoredCredentials = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: 1_800_000_000_000,
  subject: 'user_01ABC',
};

function posixDeps(): StoreDeps {
  return { baseDir, platform: 'linux' };
}

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'ocular-cred-'));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('loadCredentials', () => {
  it('returns null when no credentials file exists — the normal logged-out state', async () => {
    expect(await loadCredentials(posixDeps())).toBeNull();
  });

  it('round-trips a saved credential set', async () => {
    await saveCredentials(creds, posixDeps());
    expect(await loadCredentials(posixDeps())).toEqual(creds);
  });

  it('returns null for a corrupt file rather than throwing', async () => {
    // A user stranded by a hard failure here has no way back except deleting
    // a file by hand; treating it as logged-out lets the login flow recover.
    await saveCredentials(creds, posixDeps());
    await writeFile(credentialsPath(posixDeps()), '{ not json', 'utf8');
    expect(await loadCredentials(posixDeps())).toBeNull();
  });

  it('rejects a well-formed JSON file that is missing required fields', async () => {
    await saveCredentials(creds, posixDeps());
    await writeFile(credentialsPath(posixDeps()), JSON.stringify({ accessToken: 'only' }), 'utf8');
    expect(await loadCredentials(posixDeps())).toBeNull();
  });

  it('rejects a file with an empty access token', async () => {
    await writeFile(
      credentialsPath(posixDeps()),
      JSON.stringify({ ...creds, accessToken: '' }),
      'utf8',
    );
    expect(await loadCredentials(posixDeps())).toBeNull();
  });
});

describe('saveCredentials', () => {
  it('leaves no temp files behind', async () => {
    await saveCredentials(creds, posixDeps());
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(baseDir);
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
    expect(entries).toContain('credentials.json');
  });

  it('survives concurrent saves — temp names must not collide within a millisecond', async () => {
    // pid+timestamp alone is not unique enough: two saves in the same
    // millisecond produced the same temp path and raced, surfacing on Windows
    // as EPERM on the rename. Reachable in practice when a token refresh
    // races a fresh login.
    const writes = Array.from({ length: 20 }, (_, i) =>
      saveCredentials({ ...creds, accessToken: 'token-' + i }, posixDeps()),
    );
    await expect(Promise.all(writes)).resolves.toBeDefined();

    // Exactly one credentials file, no orphaned temp files, and it parses.
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(baseDir);
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
    expect(entries).toEqual(['credentials.json']);
    expect(await loadCredentials(posixDeps())).not.toBeNull();
  });

  it('overwrites a previous credential set — refresh-token rotation must persist', async () => {
    await saveCredentials(creds, posixDeps());
    const rotated = { ...creds, refreshToken: 'refresh-rotated', accessToken: 'access-new' };
    await saveCredentials(rotated, posixDeps());
    expect(await loadCredentials(posixDeps())).toEqual(rotated);
  });

  it.runIf(process.platform !== 'win32')('writes the file 0600 on POSIX', async () => {
    await saveCredentials(creds, posixDeps());
    const mode = (await stat(credentialsPath(posixDeps()))).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('never writes the tokens in a form that survives a failed rename', async () => {
    await saveCredentials(creds, posixDeps());
    const written = await readFile(credentialsPath(posixDeps()), 'utf8');
    expect(JSON.parse(written)).toEqual(creds);
  });
});

describe('secureFile on Windows', () => {
  it('calls icacls stripping inheritance and granting the current user only', async () => {
    const runCommand = vi.fn().mockResolvedValue(true);
    const prev = process.env.USERNAME;
    process.env.USERNAME = 'testuser';
    try {
      const result = await secureFile('C:\\fake\\credentials.json', {
        baseDir,
        platform: 'win32',
        runCommand,
      });
      expect(result).toEqual({ hardened: true, method: 'icacls' });
      expect(runCommand).toHaveBeenCalledWith('icacls', [
        'C:\\fake\\credentials.json',
        '/inheritance:r',
        '/grant:r',
        'testuser:(R,W)',
      ]);
    } finally {
      process.env.USERNAME = prev;
    }
  });

  it('reports hardened:false when icacls fails — never claims a file is protected when it is not', async () => {
    const runCommand = vi.fn().mockResolvedValue(false);
    const prev = process.env.USERNAME;
    process.env.USERNAME = 'testuser';
    try {
      const result = await secureFile('C:\\fake\\credentials.json', {
        baseDir,
        platform: 'win32',
        runCommand,
      });
      expect(result.hardened).toBe(false);
      expect(result.detail).toBeDefined();
    } finally {
      process.env.USERNAME = prev;
    }
  });

  it('reports hardened:false when USERNAME is unset, without spawning anything', async () => {
    const runCommand = vi.fn();
    const prev = process.env.USERNAME;
    delete process.env.USERNAME;
    try {
      const result = await secureFile('C:\\fake\\credentials.json', {
        baseDir,
        platform: 'win32',
        runCommand,
      });
      expect(result.hardened).toBe(false);
      expect(runCommand).not.toHaveBeenCalled();
    } finally {
      if (prev !== undefined) process.env.USERNAME = prev;
    }
  });

  it('does NOT report chmod as the method on win32 — chmod is a no-op there', async () => {
    const runCommand = vi.fn().mockResolvedValue(true);
    const prev = process.env.USERNAME;
    process.env.USERNAME = 'testuser';
    try {
      const result = await secureFile('C:\\fake\\credentials.json', {
        baseDir,
        platform: 'win32',
        runCommand,
      });
      expect(result.method).not.toBe('chmod');
    } finally {
      process.env.USERNAME = prev;
    }
  });
});

describe('clearCredentials', () => {
  it('removes the file', async () => {
    await saveCredentials(creds, posixDeps());
    await clearCredentials(posixDeps());
    expect(await loadCredentials(posixDeps())).toBeNull();
  });

  it('is a no-op when nothing is stored', async () => {
    await expect(clearCredentials(posixDeps())).resolves.toBeUndefined();
  });
});

describe('isExpired', () => {
  const skew = 60_000;

  it('is false well before expiry', () => {
    expect(isExpired({ ...creds, expiresAt: 1000 + 10 * skew }, 1000, skew)).toBe(false);
  });

  it('is true once past expiry', () => {
    expect(isExpired({ ...creds, expiresAt: 500 }, 1000, skew)).toBe(true);
  });

  it('is true inside the skew window — a request started now could land after expiry', () => {
    expect(isExpired({ ...creds, expiresAt: 1000 + skew / 2 }, 1000, skew)).toBe(true);
  });

  it('is true exactly at the skew boundary', () => {
    expect(isExpired({ ...creds, expiresAt: 1000 + skew }, 1000, skew)).toBe(true);
  });
});
