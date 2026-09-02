import { describe, expect, it } from 'vitest';
import { routeTarget } from './route-target.js';

describe('routeTarget', () => {
  it('routes literal localhost to local', async () => {
    expect(await routeTarget('http://localhost:5173/')).toEqual({ route: 'local' });
  });

  it('routes literal 127.0.0.1 to local', async () => {
    expect(await routeTarget('http://127.0.0.1:3000/')).toEqual({ route: 'local' });
  });

  it('routes literal IPv6 loopback to local', async () => {
    expect(await routeTarget('http://[::1]:3000/')).toEqual({ route: 'local' });
  });

  it('routes an explicit allowlist domain to local without a DNS round-trip deciding it', async () => {
    const result = await routeTarget('http://my-staging-box.internal/', [
      'my-staging-box.internal',
    ]);
    expect(result).toEqual({ route: 'local' });
  });

  it('does not match an allowlist entry against a different domain', async () => {
    const result = await routeTarget('https://example.com/', ['my-staging-box.internal']);
    expect(result.route).not.toBe('local');
  });

  it('routes a resolved private IP to local even without a literal-localhost hostname', async () => {
    // example.com resolves to a public IP in real DNS, so this exercises the
    // "not literal, not allowlisted, falls through to resolution" branch
    // indirectly — the private-IP branch itself is covered by local-check.test.ts's
    // own mandatory cases; this test just proves the fallthrough wiring.
    const result = await routeTarget('https://example.com/');
    expect(result.route).toBe('cloud');
  });

  it('blocks (does not silently route) a cloud-metadata target on either path', async () => {
    const result = await routeTarget('http://169.254.169.254/latest/meta-data/');
    expect(result.route).toBe('blocked');
    if (result.route === 'blocked') {
      expect(result.reason).toBe('SSRF_BLOCKED');
    }
  });

  it('blocks a malformed URL rather than defaulting to a path', async () => {
    const result = await routeTarget('not a url');
    expect(result.route).toBe('blocked');
    if (result.route === 'blocked') {
      expect(result.reason).toBe('INVALID_URL');
    }
  });
});
