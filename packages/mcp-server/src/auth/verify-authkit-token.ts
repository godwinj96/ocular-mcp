// Real cryptographic verification of an AuthKit-issued JWT — signature, expiry,
// issuer, and audience, via `jose`. See docs/rules/04-mcp-server-and-auth.md §2.
//
// Split out from verify-jwt.ts deliberately: this layer is fully implementable
// today (no external dependency beyond the AuthKit tenant's public JWKS), while
// account/plan resolution in verify-jwt.ts still requires Neon Postgres, which
// isn't provisioned yet (see DEVLOG.md). Any failure here throws — fail closed,
// never fail open on a JWKS fetch error or a bad signature.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { config } from '../config.js';

export interface AuthKitClaims extends JWTPayload {
  sub: string;
}

interface OidcDiscoveryDocument {
  jwks_uri: string;
}

// AuthKit's JWKS does NOT live at a predictable path relative to the issuer —
// confirmed against the live tenant: issuer https://api.workos.com/user_management/<id>,
// but jwks_uri https://api.workos.com/sso/jwks/<id> (a different subpath entirely).
// docs/rules/04-mcp-server-and-auth.md §1 requires relying on the published discovery
// document instead of hand-rolling a URL pattern — this does real OIDC discovery.
async function discoverJwksUri(issuerUrl: string): Promise<string> {
  const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`AuthKit discovery document fetch failed: ${response.status} ${discoveryUrl}`);
  }
  const doc = (await response.json()) as OidcDiscoveryDocument;
  if (typeof doc.jwks_uri !== 'string') {
    throw new Error(`AuthKit discovery document missing jwks_uri: ${discoveryUrl}`);
  }
  return doc.jwks_uri;
}

// Factory (not a bare module-scope singleton) so tests can point verification
// at a local mock JWKS endpoint instead of the real AuthKit tenant.
export function createAuthKitVerifier(issuerUrl: string, resourceIdentifier: string, jwksCooldownMs: number) {
  // Discovery only needs to run once — jwks_uri itself doesn't change. jose's
  // createRemoteJWKSet then caches the JWKS response in-process and only
  // re-fetches keys after `cooldownDuration` (JWKS_CACHE_TTL_S).
  let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
  let jwksInit: Promise<void> | undefined;

  async function ensureJwks(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (jwks) return jwks;
    jwksInit ??= discoverJwksUri(issuerUrl).then((jwksUri) => {
      jwks = createRemoteJWKSet(new URL(jwksUri), { cooldownDuration: jwksCooldownMs });
    });
    await jwksInit;
    return jwks!;
  }

  return async function verifyAuthKitToken(bearerToken: string): Promise<AuthKitClaims> {
    const keySet = await ensureJwks();
    const { payload } = await jwtVerify(bearerToken, keySet, {
      issuer: issuerUrl,
      audience: resourceIdentifier,
    });

    if (typeof payload.sub !== 'string') {
      throw new Error('AuthKit token missing sub claim');
    }

    return payload as AuthKitClaims;
  };
}

export const verifyAuthKitToken = createAuthKitVerifier(
  config.authkitIssuerUrl,
  config.authkitResourceIdentifier,
  config.authkitJwksCacheTtlS * 1000,
);
