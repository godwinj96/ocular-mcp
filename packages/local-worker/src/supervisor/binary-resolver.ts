// Resolves the path to the supervisor binary for the current platform,
// downloading it on first run if it isn't already present — real releases
// only ship the current platform's binary via a matching npm
// optionalDependency-free download, not a per-platform npm package
// (docs/rules/13-local-worker-and-distribution.md §10).
//
// Two sources, checked in order:
//  1. `dist-supervisor/` next to this package — the monorepo dev/CI build
//     produced by `npm run build:supervisor` (scripts/build-supervisor.cjs).
//     Always preferred when present so local development never touches the
//     network.
//  2. A cached, checksum-verified download to `~/.ocular/bin/<version>/` —
//     the path a real `npx useocular` install takes, since a published npm
//     tarball never contains Go binaries for platforms it wasn't built on.
//
// The checksum is never trusted from the download itself (that would just
// be verifying a file against a hash served alongside the same file, which
// proves nothing about tampering in transit or a compromised release). It's
// pinned in supervisor-checksums.json, committed to the repo and shipped
// inside the npm tarball — the same integrity boundary npm's own package
// hash already covers. A platform missing an entry there is a hard error,
// never a silent skip-verification fallback.

import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export type SupportedPlatformKey = 'win32-x64' | 'darwin-x64' | 'darwin-arm64' | 'linux-x64';

export function platformKey(): SupportedPlatformKey {
  const key = `${process.platform}-${process.arch}`;
  if (
    key === 'win32-x64' ||
    key === 'darwin-x64' ||
    key === 'darwin-arm64' ||
    key === 'linux-x64'
  ) {
    return key;
  }
  throw new Error(
    `Unsupported platform/arch for the Ocular local worker: ${key}. Supported: win32-x64, darwin-x64, darwin-arm64, linux-x64.`,
  );
}

function binaryFileName(key: SupportedPlatformKey): string {
  return key.startsWith('win32') ? 'ocular-supervisor.exe' : 'ocular-supervisor';
}

interface ChecksumManifest {
  version: string;
  binaries: Record<SupportedPlatformKey, string | null>;
}

async function readChecksumManifest(): Promise<ChecksumManifest> {
  const raw = await readFile(path.join(pkgRoot, 'supervisor-checksums.json'), 'utf8');
  return JSON.parse(raw) as ChecksumManifest;
}

function devBuildPath(key: SupportedPlatformKey): string {
  return path.join(pkgRoot, 'dist-supervisor', binaryFileName(key));
}

function cachedDownloadPath(version: string, key: SupportedPlatformKey): string {
  return path.join(homedir(), '.ocular', 'bin', version, binaryFileName(key));
}

function releaseAssetUrl(version: string, key: SupportedPlatformKey): string {
  // Cross-compiled and published by .github/workflows/release-supervisor.yml
  // on every `supervisor-v*` tag — see that workflow for the exact naming.
  return `https://github.com/godwinj96/ocular-mcp/releases/download/supervisor-v${version}/${key}-${binaryFileName(key)}`;
}

function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

async function downloadAndVerify(key: SupportedPlatformKey): Promise<string> {
  const manifest = await readChecksumManifest();
  const expectedHash = manifest.binaries[key];
  if (!expectedHash) {
    throw new Error(
      `No pinned checksum for platform "${key}" in supervisor-checksums.json — a supervisor release ` +
        `for this platform hasn't been published yet, so an unverified download is refused rather than ` +
        `silently trusted. Run \`npm run build:supervisor\` from source instead, or wait for a release.`,
    );
  }

  const url = releaseAssetUrl(manifest.version, key);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download supervisor binary from ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  const actualHash = sha256Hex(bytes);
  if (actualHash !== expectedHash) {
    throw new Error(
      `Supervisor binary checksum mismatch for ${key}: expected ${expectedHash}, got ${actualHash}. ` +
        `Refusing to run a binary that doesn't match the pinned checksum — this could indicate a ` +
        `corrupted download or a compromised release.`,
    );
  }

  const finalPath = cachedDownloadPath(manifest.version, key);
  await mkdir(path.dirname(finalPath), { recursive: true });
  // Write-then-rename so a crash mid-download never leaves a partially
  // written file at the path future runs would treat as already-verified.
  const tmpPath = `${finalPath}.download`;
  await writeFile(tmpPath, bytes, { mode: 0o755 });
  await rename(tmpPath, finalPath);
  if (process.platform !== 'win32') {
    await chmod(finalPath, 0o755);
  }

  return finalPath;
}

export interface ResolveOptions {
  /** Test-only escape hatch — skip the dev-build short-circuit so download/checksum logic is reachable without deleting the committed dist-supervisor/ binary. */
  skipDevBuild?: boolean;
}

export async function resolveSupervisorBinaryPath(opts: ResolveOptions = {}): Promise<string> {
  const key = platformKey();

  if (!opts.skipDevBuild) {
    const devPath = devBuildPath(key);
    if (existsSync(devPath)) return devPath;
  }

  const manifest = await readChecksumManifest().catch(() => null);
  if (manifest) {
    const cached = cachedDownloadPath(manifest.version, key);
    if (existsSync(cached)) return cached;
  }

  return downloadAndVerify(key);
}
