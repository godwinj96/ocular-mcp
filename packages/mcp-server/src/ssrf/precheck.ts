// Fast, non-authoritative SSRF pre-check — rejects obviously-private targets
// before spending a queue slot. Resolves the hostname once and rejects if any
// resolved address is private; the authoritative, resolve-time-plus-every-
// redirect-hop check lives in packages/worker/src/ssrf/authoritative-check.ts
// and is never skipped just because this pre-check passed. See
// docs/rules/07-security.md §2.

import { lookup } from 'node:dns/promises';

export interface PrecheckResult {
  blocked: boolean;
  reason?: 'INVALID_URL' | 'SSRF_BLOCKED';
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, includes 169.254.169.254 cloud metadata
  if (a === 0) return true; // "this network"
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (/^f[cd][0-9a-f]{0,2}:/.test(normalized)) return true; // fc00::/7 (ULA)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]); // IPv4-mapped IPv6
  return false;
}

// Normalize (URL parsing lower-cases/punycode-encodes the hostname) before
// any resolution attempt — per docs/rules/07-security.md §2, never
// check-then-normalize.
export async function precheckUrl(url: string): Promise<PrecheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { blocked: true, reason: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { blocked: true, reason: 'INVALID_URL' };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  let resolved: { address: string; family: number }[];
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    // Unresolvable hostname isn't a private-IP hit; let the worker's
    // authoritative fetch-time check produce the real failure — this
    // pre-check only needs to catch obviously-bad input cheaply.
    return { blocked: false };
  }

  const hasPrivateAddress = resolved.some(({ address, family }) =>
    family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address),
  );

  return hasPrivateAddress ? { blocked: true, reason: 'SSRF_BLOCKED' } : { blocked: false };
}
