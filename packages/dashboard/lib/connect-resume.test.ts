import { describe, expect, it } from 'vitest';
import { resumeConnectUrl } from './connect-resume';

const valid = JSON.stringify({
  redirectUri: 'http://127.0.0.1:53219/callback',
  codeChallenge: 'the-challenge',
  state: 'the-state',
});

describe('resumeConnectUrl', () => {
  it('rebuilds a /connect URL from a valid cookie', () => {
    const url = resumeConnectUrl(valid);
    expect(url).toBeTruthy();
    const parsed = new URL(url as string, 'https://app.example');
    expect(parsed.pathname).toBe('/connect');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:53219/callback');
    expect(parsed.searchParams.get('code_challenge')).toBe('the-challenge');
    expect(parsed.searchParams.get('state')).toBe('the-state');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('returns a relative URL so it works on any deployment host', () => {
    expect(resumeConnectUrl(valid)?.startsWith('/connect?')).toBe(true);
    expect(resumeConnectUrl(valid)).not.toContain('placeholder.invalid');
  });

  it('RE-VALIDATES the redirect target rather than trusting its own cookie', () => {
    // Anything able to set a cookie on this origin can put a value here, so
    // "we wrote it" is not proof of what it contains.
    const hostile = JSON.stringify({
      redirectUri: 'https://evil.example/callback',
      codeChallenge: 'c',
      state: 's',
    });
    expect(resumeConnectUrl(hostile)).toBeNull();
  });

  it('rejects a non-loopback redirect even when otherwise well formed', () => {
    const lan = JSON.stringify({
      redirectUri: 'http://192.168.1.10:8931/callback',
      codeChallenge: 'c',
      state: 's',
    });
    expect(resumeConnectUrl(lan)).toBeNull();
  });

  it('returns null for absent, empty, and malformed cookies without throwing', () => {
    // This runs on the page a user lands on right after paying; a 500 there
    // is the worst possible failure mode.
    expect(resumeConnectUrl(undefined)).toBeNull();
    expect(resumeConnectUrl(null)).toBeNull();
    expect(resumeConnectUrl('')).toBeNull();
    expect(resumeConnectUrl('{ not json')).toBeNull();
    expect(resumeConnectUrl('"a string"')).toBeNull();
    expect(resumeConnectUrl('null')).toBeNull();
    expect(resumeConnectUrl('[]')).toBeNull();
  });

  it('returns null when a required field is missing or empty', () => {
    expect(
      resumeConnectUrl(JSON.stringify({ redirectUri: 'http://127.0.0.1:1/cb', state: 's' })),
    ).toBeNull();
    expect(
      resumeConnectUrl(
        JSON.stringify({ redirectUri: 'http://127.0.0.1:1/cb', codeChallenge: '', state: 's' }),
      ),
    ).toBeNull();
    expect(
      resumeConnectUrl(
        JSON.stringify({ redirectUri: 'http://127.0.0.1:1/cb', codeChallenge: 'c', state: '' }),
      ),
    ).toBeNull();
  });

  it('returns null when a field has the wrong type', () => {
    expect(
      resumeConnectUrl(
        JSON.stringify({ redirectUri: 'http://127.0.0.1:1/cb', codeChallenge: 42, state: 's' }),
      ),
    ).toBeNull();
  });
});
