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

  it('refuses to download when the manifest has no pinned hash for this platform', async () => {
    // Reads a fixture manifest with every entry null rather than the
    // committed one: since supervisor-v0.1.0 shipped, every real platform
    // has a pinned hash, so the committed manifest can no longer exercise
    // this path. What's under test is the refusal itself — an unpinned
    // platform must fail loudly, never fall through to an unverified
    // download.
    const manifestPath = path.join(import.meta.dirname, '__fixtures__', 'unpinned-checksums.json');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(resolveSupervisorBinaryPath({ skipDevBuild: true, manifestPath })).rejects.toThrow(
      /No pinned checksum/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
