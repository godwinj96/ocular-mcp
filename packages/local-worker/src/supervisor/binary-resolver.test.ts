import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { platformKey, resolveSupervisorBinaryPath } from './binary-resolver.js';

describe('platformKey', () => {
  it('returns a supported key for the current process platform/arch or throws clearly', () => {
    const key = `${process.platform}-${process.arch}`;
    const supported = ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64'];
    if (supported.includes(key)) {
      expect(platformKey()).toBe(key);
    } else {
      expect(() => platformKey()).toThrow(/Unsupported platform\/arch/);
    }
  });
});

describe('resolveSupervisorBinaryPath', () => {
  const cacheRoot = path.join(homedir(), '.ocular', 'bin');

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(cacheRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  it('refuses to download when supervisor-checksums.json has no pinned hash for this platform (current committed manifest — placeholder version)', async () => {
    // supervisor-checksums.json ships with every binaries.* entry as null
    // until the release workflow has run for real (see that file's own
    // comment) — this proves the resolver fails loudly instead of silently
    // trusting an unverified download when that's still the case, and that
    // no dist-supervisor/ dev build exists in this test environment to
    // short-circuit the check.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(resolveSupervisorBinaryPath({ skipDevBuild: true })).rejects.toThrow(
      /No pinned checksum/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
