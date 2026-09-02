# Ocular — MCP Server & Auth Rules

**Section 4 of 13 · Always Apply**

---

## 0. Guiding principles

1. **Every request is verified before any tool logic runs.** No exceptions, no debug bypass, not even in dev — use a dev-only static key instead of disabling verification.
2. **Fail closed.** Any ambiguity in token verification, account resolution, or plan lookup → `UNAUTHORIZED`, never a default/guest quota.
3. **Two auth paths, one verification funnel.** AuthKit JWT and static API key both resolve to the same `{ accountId, plan }` shape before touching tool logic — tool handlers never know which path was used.
4. **Stateless service.** No session state, no sticky routing. Everything durable lives in Redis or Postgres so `mcp-server` can run N replicas behind a load balancer.

---

## 1. Auth infra (one-time setup, not code — do this first)

1. Create a WorkOS AuthKit tenant/project for Ocular.
2. Register Ocular's `mcp-server` as the **protected resource** per MCP's Protected Resource Metadata spec.
3. Enable **dynamic client registration** + Client ID Metadata Document (Nov-2025 MCP spec) so clients self-register.
4. Add Google (and optionally GitHub) as upstream social connections in AuthKit.
5. Rely on AuthKit's published `/.well-known/oauth-authorization-server` and JWKS endpoints — do not hand-roll OAuth discovery.

---

## 2. Token verification (per request)

```typescript
// packages/mcp-server/src/auth/verify-jwt.ts
// - Verify signature against AuthKit's JWKS (cached, TTL = JWKS_CACHE_TTL_S)
// - Check `aud` matches Ocular's resource identifier — reject tokens minted for another resource
// - Check expiry
// - On ANY failure: throw an auth error that maps to MCP's 401 + WWW-Authenticate
//   pointing at the resource metadata URL (spec requirement — lets compliant clients re-auth)
```

```typescript
// packages/mcp-server/src/auth/verify-static-key.ts
// - Accept `Authorization: Bearer <static-api-key>` as a fallback path
// - Look up the key directly in Postgres (account table) — no AuthKit round-trip
// - Keys are revocable and rotatable; no default expiry
// - This is the ONLY path for headless/CI/unattended-agent use (no browser for OAuth flow)
```

**Rule:** both verification functions return the same shape — `{ accountId: string; plan: string; authMethod: 'oauth' | 'static_key' }` — consumed by `resolve-account.ts`. `authMethod` is logged (see `09-error-handling-and-logging.md` §3) but never changes tool behavior.

**Rule:** JWKS is cached in-process with rotation handling (respect `JWKS_CACHE_TTL_S`), not fetched per-request. A JWKS fetch failure does not fail open — treat as `UNAUTHORIZED` and let the client retry.

---

## 3. Per-request pipeline (the order matters)

```
1. Extract bearer token from Authorization header. Missing/malformed -> UNAUTHORIZED immediately.
2. Verify (JWT or static key per §2). Failure -> UNAUTHORIZED.
3. resolve-account.ts: token/key -> { accountId, plan } (cached briefly in-process, short TTL).
   AuthKit-authenticated user with no matching Postgres account row -> UNAUTHORIZED
   (webhook lag from Bachs is NOT a reason to grant default quota — see 11-billing-and-quota.md).
4. Zod-validate tool args against the schema from @ocular/shared. Invalid -> INVALID_URL or a
   structured validation error, never a raw Zod error object back to the client.
5. SSRF pre-check the URL (fast, non-authoritative — see 07-security.md §2). Fail -> SSRF_BLOCKED.
6. Atomic quota check in Redis (see 11-billing-and-quota.md §2). Over cap -> QUOTA_EXCEEDED,
   rejected BEFORE enqueue — never enqueue a job that will be billed against an exhausted account.
7. Enqueue BullMQ job { tool, args, account, requestId, deadlineMs }, attempts: 1.
8. Await completion up to SERVER_AWAIT_MS. Exceeded -> TIMEOUT.
9. Map ResultEnvelope -> MCP content blocks (success) or MCP tool error (failure).
```

Every rejection before step 7 must NOT enqueue a job and must NOT touch quota accounting beyond the read in step 6 — nothing is charged for a request that never reached the worker.

---

## 4. MCP protocol mapping

```typescript
// packages/mcp-server/src/mcp/to-content-blocks.ts
// SuccessEnvelope.image -> an MCP image content block (base64, mime image/webp)
// SuccessEnvelope.data  -> an MCP text content block (JSON.stringify, compact)
// FailureEnvelope       -> an MCP tool error; `message` only, never `partial` raw dump
//                          unless the tool schema explicitly documents returning partial data
```

**Rule:** `mcp-server` never leaks internal envelope fields (`rungReached`, `meta.durationMs`, etc.) into user-facing MCP error messages beyond what's explicitly useful to the agent (e.g., final URL, dimensions). Internal fields go to structured logs, not the wire response.

---

## 5. Framework and transport

- Framework: **Fastify** (schema support, throughput) with `@modelcontextprotocol/sdk`'s Streamable HTTP transport. Do not introduce Express or a second HTTP framework.
- Scaling: stateless aside from short-lived in-process caches (JWKS, account resolution) → run ≥2 replicas behind a load balancer as soon as there's a load balancer to run behind.

---

## 6. Checklist — adding a new tool

```
[ ] Zod input schema defined in packages/shared/src/schemas/
[ ] Tool handler in packages/mcp-server/src/tools/ follows the §3 pipeline exactly
[ ] Tool registered in the MCP server's tools/list response with a clear description
[ ] Corresponding extractor added in packages/worker/src/extractors/ (if it renders/extracts)
[ ] Charge policy for this tool documented in 11-billing-and-quota.md if it differs from the default
[ ] Tool added to the table in 01-architecture.md §4
```

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
