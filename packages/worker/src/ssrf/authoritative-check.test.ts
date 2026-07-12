import { describe, expect, it } from 'vitest';
import { authoritativeSsrfCheck } from './authoritative-check.js';

// Mirrors packages/mcp-server/src/ssrf/precheck.test.ts's mandatory cases from
// docs/rules/10-testing.md §2 — this is the authoritative, worker-side check
// (never skipped just because the mcp-server pre-check passed).
describe('authoritativeSsrfCheck', () => {
  it.each(['file:///etc/passwd', 'data:text/plain;base64,aGVsbG8=', 'ftp://example.com/file', 'javascript:alert(1)'])(
    'rejects non-http(s) scheme: %s',
    async (url) => {
      const result = await authoritativeSsrfCheck(url);
      expect(result).toEqual({ blocked: true, reason: 'INVALID_URL' });
    },
  );

  it('rejects an unparseable URL', async () => {
    const result = await authoritativeSsrfCheck('not a url');
    expect(result).toEqual({ blocked: true, reason: 'INVALID_URL' });
  });

  it('rejects a hostname resolving to 127.0.0.1', async () => {
    const result = await authoritativeSsrfCheck('http://127.0.0.1/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it('rejects a hostname resolving to ::1', async () => {
    const result = await authoritativeSsrfCheck('http://[::1]/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it.each(['http://10.1.2.3/', 'http://172.16.0.1/', 'http://192.168.1.1/'])(
    'rejects an RFC1918 address: %s',
    async (url) => {
      const result = await authoritativeSsrfCheck(url);
      expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
    },
  );

  it('rejects 169.254.169.254 (cloud metadata) specifically', async () => {
    const result = await authoritativeSsrfCheck('http://169.254.169.254/latest/meta-data/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it('rejects an fc00::/7 (ULA) address', async () => {
    const result = await authoritativeSsrfCheck('http://[fd00::1]/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it('accepts a normal public HTTPS URL', async () => {
    const result = await authoritativeSsrfCheck('https://example.com/');
    expect(result).toEqual({ blocked: false });
  });

  it('rejects an unresolvable hostname as INVALID_URL', async () => {
    // Unlike mcp-server's precheck (which defers to this layer for
    // unresolvable hosts), this IS the authoritative layer — an
    // unresolvable host is never allowed through to navigation.
    const result = await authoritativeSsrfCheck('https://this-domain-should-not-resolve.invalid/');
    expect(result).toEqual({ blocked: true, reason: 'INVALID_URL' });
  });
});
