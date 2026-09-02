// Local cache — device-only, never transmitted. See
// docs/rules/13-local-worker-and-distribution.md §7: "nothing rendered by
// local-worker is ever uploaded to the cloud cache. Not as telemetry, not
// as a contribution, not opportunistically." This file has no network
// client of any kind (no Redis, no HTTP) — it only ever touches the local
// filesystem, which is the structural guarantee behind that rule, same
// spirit as ../http/cloud-client.ts being the only network-facing module
// in this package.
//
// One JSON file per cache key (not a single index file) — simpler to
// reason about, no read-modify-write race between concurrent captures, and
// a stale/corrupt entry only ever affects itself, never the whole cache.

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { CACHE_TTL_STANDARD_S, computeCacheKey } from '@ocular/shared';
import type { ResultEnvelope, ToolName } from '@ocular/shared';

interface CacheEntry {
  envelope: ResultEnvelope;
  expiresAt: number;
}

export function resolveCacheDir(): string {
  const base =
    process.platform === 'win32'
      ? (process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'))
      : process.platform === 'darwin'
        ? path.join(homedir(), 'Library', 'Caches')
        : (process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache'));
  return path.join(base, 'ocular', 'local-worker', 'cache');
}

function entryPath(cacheDir: string, key: string): string {
  // Cache keys are already `cache:<tool>:<sha256-hex>` — safe as a filename
  // once colons are swapped out (Windows forbids `:` in filenames).
  return path.join(cacheDir, `${key.replace(/:/g, '_')}.json`);
}

export class LocalCache {
  constructor(private readonly cacheDir: string = resolveCacheDir()) {}

  async get(tool: ToolName, args: Record<string, unknown>): Promise<ResultEnvelope | null> {
    const file = entryPath(this.cacheDir, computeCacheKey(tool, args));
    let raw: string;
    try {
      raw = await readFile(file, 'utf-8');
    } catch {
      return null; // no entry — a normal miss, not an error.
    }

    let entry: CacheEntry;
    try {
      entry = JSON.parse(raw) as CacheEntry;
    } catch {
      return null; // corrupted entry — treat as a miss, same as the cloud reader.
    }

    if (Date.now() >= entry.expiresAt) {
      await rm(file, { force: true }).catch(() => undefined);
      return null;
    }

    return entry.envelope;
  }

  async set(
    tool: ToolName,
    args: Record<string, unknown>,
    envelope: ResultEnvelope,
    ttlSeconds: number = CACHE_TTL_STANDARD_S,
  ): Promise<void> {
    if (!envelope.ok) return; // same rule as the cloud cache — never cache a failure.
    await mkdir(this.cacheDir, { recursive: true });
    const entry: CacheEntry = { envelope, expiresAt: Date.now() + ttlSeconds * 1000 };
    await writeFile(entryPath(this.cacheDir, computeCacheKey(tool, args)), JSON.stringify(entry));
  }
}

export const defaultLocalCache = new LocalCache();
