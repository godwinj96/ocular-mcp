# Ocular — Environment & Secrets Rules

**Section 12 of 13 · Always Apply**

---

## 0. Guiding principles

1. **Validate all required env vars at process startup — fail loudly, not silently.** A missing `REDIS_URL` should crash the process on boot, never surface as a confusing runtime error three requests later.
2. **No secret ever reaches a client bundle** — n/a for image but relevant if a future admin dashboard is added; keep the boundary explicit now so it's not re-litigated later.
3. **Each package owns its own config module** — `packages/shared` never reads `process.env` (see `03-shared-contracts.md` §5).

---

## 1. Env var naming

`SCREAMING_SNAKE_CASE`, prefixed by package when the var is package-specific, unprefixed when it's genuinely shared infra:

```bash
# Shared infra (read by both mcp-server and worker)
REDIS_URL=
POSTGRES_URL=
NODE_ENV=development|staging|production

# mcp-server
MCP_SERVER_PORT=
AUTHKIT_ISSUER_URL=
AUTHKIT_RESOURCE_IDENTIFIER=
AUTHKIT_JWKS_CACHE_TTL_S=
# Optional. Comma-separated exact-match allowlist for the Origin header on
# /mcp requests — real MCP clients never send Origin at all (only a browser
# context does), so the default (empty = reject any request that carries
# Origin) is correct until there's an actual browser-based caller to allow.
MCP_ALLOWED_ORIGINS=
# Where /worker/heartbeat forwards to after authenticating the caller — the
# dashboard, which owns worker/audit persistence (see
# docs/rules/02-repo-structure.md §0.6). Not necessarily the public dashboard
# URL; a deployment-internal address is fine.
DASHBOARD_INTERNAL_URL=
# Shared secret between mcp-server and dashboard's /api/internal/* routes —
# the SAME value in both packages' env. Proves the caller is mcp-server, not
# the end user's own bearer token verified a second time.
INTERNAL_SERVICE_SECRET=

# dashboard — Bachs lives here, not mcp-server: dashboard is the only
# package that talks to Bachs (see docs/rules/11-billing-and-quota.md §3;
# mcp-server never calls Bachs synchronously in the request path).
# Four product IDs, not one — Basic/Pro x Monthly/Annual (see plans.ts in
# @ocular/shared for the plan-slug scheme these map to).
NEXT_PUBLIC_APP_URL=
# Same value as mcp-server's INTERNAL_SERVICE_SECRET above — verifies
# app/api/internal/* callers are mcp-server, not a browser.
INTERNAL_SERVICE_SECRET=
BACHS_API_KEY=
BACHS_WEBHOOK_SECRET=
BACHS_BASIC_MONTHLY_PRICE_ID=
BACHS_BASIC_ANNUAL_PRICE_ID=
BACHS_PRO_MONTHLY_PRICE_ID=
BACHS_PRO_ANNUAL_PRICE_ID=

# worker
WORKER_RENDER_CONCURRENCY=
WORKER_QUEUE_CONCURRENCY=
# Rung 0 (dc-proxy) + rung 1 (residential-proxy, -rotate suffix in code).
WEBSHARE_PROXY_URL=
WEBSHARE_PROXY_CREDENTIALS=
# Rung 3 (paid-unblocker) — Decodo's Site Unblocker, proxy-style username/
# password auth, not a bearer API key. Pro-tier only.
DECODO_UNBLOCKER_USERNAME=
DECODO_UNBLOCKER_PASSWORD=
DAILY_PAID_BUDGET_USD=
# Rung 2 (Camoufox) and rung 1's originally-planned vendor (DataImpulse) are
# deferred/dropped — no env vars for either (see DEVLOG for rationale).
```

---

## 2. Config module pattern (per package)

```typescript
// packages/mcp-server/src/config.ts
const required = ['REDIS_URL', 'POSTGRES_URL', 'AUTHKIT_ISSUER_URL', 'AUTHKIT_RESOURCE_IDENTIFIER'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Check your .env file.`);
  }
}

export const config = {
  redisUrl: process.env.REDIS_URL!,
  postgresUrl: process.env.POSTGRES_URL!,
  authkitIssuerUrl: process.env.AUTHKIT_ISSUER_URL!,
  authkitResourceId: process.env.AUTHKIT_RESOURCE_IDENTIFIER!,
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'staging' | 'production',
  isProd: process.env.NODE_ENV === 'production',
} as const;

if (
  config.isProd &&
  !config.postgresUrl.startsWith('postgres://') &&
  !config.postgresUrl.startsWith('postgresql://')
) {
  throw new Error('Production POSTGRES_URL must be a valid postgres connection string');
}
```

`worker` has its own equivalent `config.ts` validating its own required set (proxy URLs/credentials, `DAILY_PAID_BUDGET_USD`, etc.). No cross-importing of one package's `config.ts` into the other.

---

## 3. Secret storage

- Local dev: `.env` files, **never committed** (already covered by `.gitignore` — verify it stays that way as new services are added).
- Staging/production: `dashboard`/`website` run on Vercel (env vars via Vercel's own project settings). `worker`/`mcp-server`'s hosting is **not yet decided** (see DEVLOG Session 26 — the earlier "Hetzner" plan was never actually provisioned); whatever host is chosen, secrets are injected via that platform's own mechanism — never baked into an image layer, never committed to `infra/`.
- Rotate immediately anything that may have been exposed (accidental commit, log leak) — proxy credentials, AuthKit signing keys, Bachs webhook secret, DB/Redis URLs.

---

## 4. What counts as a secret (never logged, never in error messages — see `09-error-handling-and-logging.md` §2–3)

```
AuthKit signing keys / client secrets
Bachs webhook secret / API keys
Postgres and Redis connection strings (contain credentials)
Webshare / DataImpulse / Decodo proxy credentials
Static API keys issued to Ocular's own users (hash or reference by ID in logs, never log the raw key)
```

---

## 5. `.env.example`

Every package ships an `.env.example` listing every required var with a placeholder value and a one-line comment on where to obtain it (AuthKit dashboard, Bachs sandbox, proxy provider dashboard, etc.). Keep it in sync with the config module's `required` array — a missing entry here is a rule violation, not just an inconvenience for the next engineer.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
