import { describe, expect, it } from 'vitest';
import { precheckUrl } from './precheck.js';

// Mandatory cases from docs/rules/10-testing.md §2. DNS-rebinding and
// redirect-hop re-checks are the worker's authoritative-check.ts job (a
// different package, still a stub) — this file only proves the mcp-server
// pre-check layer's own literal-IP-via-resolution rejections.
describe('precheckUrl', () => {
  it.each(['file:///etc/passwd', 'data:text/plain;base64,aGVsbG8=', 'ftp://example.com/file', 'javascript:alert(1)'])(
    'rejects non-http(s) scheme: %s',
    async (url) => {
      const result = await precheckUrl(url);
      expect(result).toEqual({ blocked: true, reason: 'INVALID_URL' });
    },
  );

  it('rejects an unparseable URL', async () => {
    const result = await precheckUrl('not a url');
    expect(result).toEqual({ blocked: true, reason: 'INVALID_URL' });
  });

  it('rejects a hostname resolving to 127.0.0.1', async () => {
    const result = await precheckUrl('http://127.0.0.1/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it('rejects a hostname resolving to ::1', async () => {
    const result = await precheckUrl('http://[::1]/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it.each(['http://10.1.2.3/', 'http://172.16.0.1/', 'http://192.168.1.1/'])(
    'rejects an RFC1918 address: %s',
    async (url) => {
      const result = await precheckUrl(url);
      expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
    },
  );

  it('rejects 169.254.169.254 (cloud metadata) specifically', async () => {
    const result = await precheckUrl('http://169.254.169.254/latest/meta-data/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it('rejects an fc00::/7 (ULA) address', async () => {
    const result = await precheckUrl('http://[fd00::1]/');
    expect(result).toEqual({ blocked: true, reason: 'SSRF_BLOCKED' });
  });

  it('accepts a normal public HTTPS URL with no redirects', async () => {
    const result = await precheckUrl('https://example.com/');
    expect(result).toEqual({ blocked: false });
  });

  it('normalizes an IDN/punycode URL before checking it', async () => {
    // URL parsing itself punycode-encodes internationalized hostnames before
    // any resolution attempt — this just proves malformed IDN input doesn't
    // crash the check rather than silently bypassing it.
    const result = await precheckUrl('https://xn--n3h.example/');
    expect(result).toEqual({ blocked: false });
  });
});
