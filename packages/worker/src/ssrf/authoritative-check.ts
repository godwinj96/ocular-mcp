// Resolve-time + per-redirect-hop authoritative SSRF check. See
// docs/rules/05-worker-and-browser-pipeline.md §1 step 2 and docs/rules/07-security.md §2.
// This is the MVP-blocking check — the mcp-server precheck (packages/mcp-server/src/ssrf/precheck.ts)
// is only a fast, non-authoritative first pass; this one is never skipped
// just because that one passed, and is re-run on every redirect hop.

import { lookup } from 'node:dns/promises';

export interface SsrfCheckResult {
  blocked: boolean;
  reason?: string;
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

// Normalize before resolution — never check-then-normalize (docs/rules/07-security.md §2).
export async function authoritativeSsrfCheck(url: string): Promise<SsrfCheckResult> {
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
    return { blocked: true, reason: 'INVALID_URL' };
  }

  if (resolved.length === 0) {
    return { blocked: true, reason: 'INVALID_URL' };
  }

  const hasPrivateAddress = resolved.some(({ address, family }) =>
    family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address),
  );

  return hasPrivateAddress ? { blocked: true, reason: 'SSRF_BLOCKED' } : { blocked: false };
}
