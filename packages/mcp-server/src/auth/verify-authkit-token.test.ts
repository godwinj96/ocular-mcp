import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { KeyLike } from 'jose';
import { createAuthKitVerifier } from './verify-authkit-token.js';

// Spins up a local HTTP server serving a real OIDC discovery document + JWKS
// instead of hitting the live AuthKit tenant — exercises the actual discovery
// + jose remote-JWKS fetch/verify path (signature, issuer, audience, expiry),
// not a mocked verifier. Mirrors AuthKit's real shape, where jwks_uri is NOT
// at a fixed path relative to the issuer and must come from discovery.
describe('verifyAuthKitToken', () => {
  let server: Server;
  let issuerUrl: string;
  let privateKey: KeyLike;
  const audience = 'https://mcp.ocular.io';
  const kid = 'test-key-1';

  beforeAll(async () => {
    const { publicKey, privateKey: signingKey } = await generateKeyPair('ES256');
    privateKey = signingKey;
    const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };

    server = createServer((req, res) => {
      if (req.url === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jwks_uri: `${issuerUrl}/sso/jwks/test` }));
        return;
      }
      if (req.url === '/sso/jwks/test') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ keys: [publicJwk] }));
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('failed to bind test JWKS server');
    }
    issuerUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  function signToken(overrides: { issuer?: string; audience?: string; expiresIn?: string } = {}): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid })
      .setSubject('user_01TESTACCOUNT')
      .setIssuedAt()
      .setIssuer(overrides.issuer ?? issuerUrl)
      .setAudience(overrides.audience ?? audience)
      .setExpirationTime(overrides.expiresIn ?? '5m')
      .sign(privateKey);
  }

  it('accepts a validly signed token with matching issuer and audience', async () => {
    const verify = createAuthKitVerifier(issuerUrl, audience, 60_000);
    const token = await signToken();

    const claims = await verify(token);

    expect(claims.sub).toBe('user_01TESTACCOUNT');
  });

  it('rejects a token with the wrong audience', async () => {
    const verify = createAuthKitVerifier(issuerUrl, audience, 60_000);
    const token = await signToken({ audience: 'https://not-ocular.example' });

    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects a token with the wrong issuer', async () => {
    const verify = createAuthKitVerifier(issuerUrl, audience, 60_000);
    const token = await signToken({ issuer: 'https://evil.example' });

    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const verify = createAuthKitVerifier(issuerUrl, audience, 60_000);
    const token = await signToken({ expiresIn: '-1h' });

    await expect(verify(token)).rejects.toThrow();
  });
});
