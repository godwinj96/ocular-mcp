import { describe, expect, it } from 'vitest';
import { localSafetyCheck } from './local-check.js';

// Mirrors the mandatory-case coverage of the cloud check
// (packages/worker/src/ssrf/authoritative-check.test.ts) but with inverted
// expectations for private IPs, per docs/rules/13-local-worker-and-distribution.md §1.
describe('localSafetyCheck', () => {
  it('rejects a non-http(s) scheme', async () => {
    const result = await localSafetyCheck('file:///etc/passwd');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('INVALID_URL');
  });

  it('rejects a malformed URL', async () => {
    const result = await localSafetyCheck('not a url');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('INVALID_URL');
  });

  it('PERMITS loopback (127.0.0.1) — the opposite of the cloud check', async () => {
    const result = await localSafetyCheck('http://127.0.0.1:3000/');
    expect(result.allowed).toBe(true);
    expect(result.isPrivate).toBe(true);
  });

  it('PERMITS a literal RFC1918 address', async () => {
    const result = await localSafetyCheck('http://192.168.1.50:8080/');
    expect(result.allowed).toBe(true);
    expect(result.isPrivate).toBe(true);
  });

  it('PERMITS IPv6 loopback', async () => {
    const result = await localSafetyCheck('http://[::1]:3000/');
    expect(result.allowed).toBe(true);
    expect(result.isPrivate).toBe(true);
  });

  it('STILL BLOCKS the cloud-metadata address even though it is link-local', async () => {
    const result = await localSafetyCheck('http://169.254.169.254/latest/meta-data/');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SSRF_BLOCKED');
  });

  it('permits a non-metadata link-local address (the rest of 169.254.0.0/16)', async () => {
    const result = await localSafetyCheck('http://169.254.1.1/');
    expect(result.allowed).toBe(true);
    expect(result.isPrivate).toBe(true);
  });

  it('allows a normal public URL and reports isPrivate: false', async () => {
    const result = await localSafetyCheck('https://example.com/');
    expect(result.allowed).toBe(true);
    expect(result.isPrivate).toBe(false);
  });
});
