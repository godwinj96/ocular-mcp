import { describe, expect, it } from 'vitest';
import { validateLoopbackRedirect } from './loopback-redirect';

function accepts(uri: string) {
  return validateLoopbackRedirect(uri).ok;
}

describe('validateLoopbackRedirect — accepts only real loopback targets', () => {
  it('accepts 127.0.0.1 with a port', () => {
    expect(accepts('http://127.0.0.1:53219/callback')).toBe(true);
  });

  it('accepts localhost with a port', () => {
    expect(accepts('http://localhost:8931/callback')).toBe(true);
  });

  it('accepts the IPv6 loopback literal', () => {
    expect(accepts('http://[::1]:8931/callback')).toBe(true);
  });

  it('returns the normalised URL it validated', () => {
    const result = validateLoopbackRedirect('http://127.0.0.1:5000/callback');
    expect(result.ok && result.redirectUri).toBe('http://127.0.0.1:5000/callback');
  });
});

describe('validateLoopbackRedirect — refuses exfiltration targets', () => {
  it('refuses an external https host', () => {
    // The core attack: a signed-in user opening this hands an authorization
    // code for their account to someone else.
    expect(accepts('https://evil.example/callback')).toBe(false);
  });

  it('refuses an external http host', () => {
    expect(accepts('http://evil.example:80/callback')).toBe(false);
  });

  it('refuses a hostname that merely CONTAINS a loopback name', () => {
    // Guards against a substring/startsWith check, which is the usual way
    // this validation gets written wrong.
    expect(accepts('http://localhost.evil.example:8931/callback')).toBe(false);
    expect(accepts('http://127.0.0.1.evil.example:8931/callback')).toBe(false);
    expect(accepts('http://notlocalhost:8931/callback')).toBe(false);
  });

  it('refuses a loopback-looking userinfo prefix pointing at another host', () => {
    // http://127.0.0.1@evil.example/ has hostname evil.example.
    expect(accepts('http://127.0.0.1@evil.example:8931/callback')).toBe(false);
  });

  it('refuses credentials embedded in a genuine loopback URL', () => {
    expect(accepts('http://user:pass@127.0.0.1:8931/callback')).toBe(false);
  });

  it('refuses non-http schemes', () => {
    expect(accepts('https://127.0.0.1:8931/callback')).toBe(false);
    expect(accepts('javascript:alert(1)')).toBe(false);
    expect(accepts('data:text/html,<script>')).toBe(false);
    expect(accepts('file:///etc/passwd')).toBe(false);
    expect(accepts('ocular://callback')).toBe(false);
  });

  it('refuses a loopback host with no explicit port', () => {
    expect(accepts('http://127.0.0.1/callback')).toBe(false);
    expect(accepts('http://localhost/callback')).toBe(false);
  });

  it('refuses a private-network address that is not loopback', () => {
    expect(accepts('http://192.168.1.50:8931/callback')).toBe(false);
    expect(accepts('http://10.0.0.5:8931/callback')).toBe(false);
    expect(accepts('http://169.254.169.254:80/latest/meta-data')).toBe(false);
  });

  it('refuses missing, empty, and malformed values', () => {
    expect(accepts('')).toBe(false);
    expect(validateLoopbackRedirect(null).ok).toBe(false);
    expect(validateLoopbackRedirect(undefined).ok).toBe(false);
    expect(accepts('not a url')).toBe(false);
    expect(accepts('//evil.example/callback')).toBe(false);
  });

  it('always explains why it refused', () => {
    const result = validateLoopbackRedirect('https://evil.example/cb');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason.length).toBeGreaterThan(0);
  });
});
