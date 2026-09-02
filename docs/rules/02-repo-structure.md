---
description: >
  Canonical monorepo layout and file naming conventions for Ocular. Read this
  before creating any new file, package, or directory.
globs:
  - 'packages/**/*'
  - 'infra/**/*'
alwaysApply: true
---

# Ocular — Repo Structure Rules

**Section 2 of 13 · Always Apply**

---

## 0. Guiding principles

1. **Package boundaries are the primary boundary** — see `01-architecture.md` §1. Folder structure within a package exists to make that boundary easy to follow, not to work around it.
2. **Layer separation inside each package** — routes/handlers, business logic, and I/O adapters are separate directories, never mixed in one file.
3. **Flat over nested** — max two levels deep inside any feature/module folder.
4. **`shared` has zero runtime dependencies on `mcp-server` or `worker`** — enforced by lint rule (`no-restricted-imports` in each package's `eslint.config.js`), not just convention.
5. **`local-worker` never imports from `worker`** — the two execution paths share contracts through `shared` only. A helper both need goes in `shared`; it is never reached across package boundaries. See `13-local-worker-and-distribution.md` §1.

---

## 1. Top-level layout

```
ocular/
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── schemas/           # Zod schemas — one file per tool + envelope.ts
│   │   │   ├── errors.ts          # ErrorCode enum + ResultEnvelope types
│   │   │   ├── job.ts             # BullMQ job payload type
│   │   │   ├── constants.ts       # Tunable constants (see 08-performance.md §0)
│   │   │   └── index.ts           # public exports only
│   │   └── package.json
│   │
│   ├── mcp-server/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── verify-jwt.ts       # AuthKit JWKS verification
│   │   │   │   ├── verify-static-key.ts # Postgres-backed key lookup
│   │   │   │   └── resolve-account.ts   # token/key -> account -> plan
│   │   │   ├── tools/
│   │   │   │   ├── view-page.ts
│   │   │   │   ├── inspect-ui.ts
│   │   │   │   ├── extract-assets.ts
│   │   │   │   └── get-quota.ts
│   │   │   ├── ssrf/
│   │   │   │   └── precheck.ts          # fast, non-authoritative reject
│   │   │   ├── quota/
│   │   │   │   └── redis-quota.ts       # atomic Redis quota ops
│   │   │   ├── queue/
│   │   │   │   └── enqueue.ts           # BullMQ producer + await
│   │   │   ├── mcp/
│   │   │   │   ├── server.ts            # Streamable HTTP transport setup
│   │   │   │   └── to-content-blocks.ts # envelope -> MCP content mapping
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   ├── worker/
│       ├── src/
│       │   ├── providers/
│       │   │   ├── browser-provider.ts     # interface
│       │   │   ├── self-hosted-provider.ts # Patchright impl — ONLY place that imports patchright
│       │   │   └── managed-provider.ts     # stub for later
│       │   ├── ladder/
│       │   │   ├── stealth-ladder.ts
│       │   │   ├── block-classifier.ts
│       │   │   ├── rung-profiles.ts
│       │   │   └── unblocker-client.ts     # Rung 3 — HTTP, not BrowserProvider
│       │   ├── routing-memory/
│       │   │   └── redis-routing-memory.ts
│       │   ├── extractors/
│       │   │   ├── screenshot.ts           # view_page
│       │   │   ├── design-tokens.ts        # inspect_ui
│       │   │   └── assets.ts               # extract_assets
│       │   ├── image/
│       │   │   └── pipeline.ts             # sharp resize/encode
│       │   ├── ssrf/
│       │   │   └── authoritative-check.ts  # resolve-time + per-redirect-hop
│       │   ├── worker.ts                    # BullMQ Worker + semaphore + recycle
│       │   └── main.ts
│       └── package.json
│
│   ├── local-worker/                      # LOCAL execution path — see 13-local-worker-and-distribution.md
│   │   ├── supervisor/                    # Go: idle timer, subprocess lifecycle, loopback IPC
│   │   │   └── main.go                    # build with -ldflags="-H windowsgui" on Windows
│   │   ├── src/
│   │   │   ├── mcp/
│   │   │   │   └── server.ts              # stdio transport; warms browser on `initialize`
│   │   │   ├── browser/
│   │   │   │   ├── headless-shell.ts      # chrome-headless-shell via CDP — ONLY CDP touchpoint
│   │   │   │   └── profile.ts             # persistent profile for auth'd pages (phase 2)
│   │   │   ├── ssrf/
│   │   │   │   └── local-check.ts         # private IPs PERMITTED; metadata ranges still blocked
│   │   │   ├── cache/
│   │   │   │   └── local-cache.ts         # device-only; never uploaded to cloud cache
│   │   │   ├── routing/
│   │   │   │   └── route-target.ts        # local vs. cloud API dispatch
│   │   │   ├── subscription/
│   │   │   │   └── validate.ts            # cached check + offline grace window
│   │   │   └── main.ts
│   │   └── package.json
│
│   ├── dashboard/                            # human-facing AUTHENTICATED surface — see research & planning/02 §17
│   │   ├── app/
│   │   │   ├── login/                        # AuthKit sign-in
│   │   │   ├── keys/                         # generate / list / revoke static API keys
│   │   │   ├── billing/                      # plan status + link-outs to Bachs checkout/portal
│   │   │   └── quota/                        # remaining calls + reset date
│   │   ├── lib/
│   │   │   ├── postgres.ts                   # direct DB access — accounts/plan/keys tables
│   │   │   ├── authkit.ts                    # login session handling
│   │   │   └── bachs.ts                      # checkout/portal link generation
│   │   └── package.json                      # Next.js, deployed to Vercel
│   │
│   └── website/                              # PUBLIC marketing site — see research & planning/06-brand-identity.md
│       ├── src/
│       │   ├── components/                   # nav, hero, how-it-works, why-reliable, pricing, faq, cta-footer, bento-grid
│       │   ├── styles/tokens.css              # brand design tokens
│       │   └── assets/                        # logo (svg/png)
│       └── package.json                       # Vite + React + Tailwind, deployed to Vercel
│
├── infra/
│   ├── docker/
│   │   ├── mcp-server.Dockerfile
│   │   └── worker.Dockerfile
│   ├── compose/
│   │   └── docker-compose.dev.yml
│   └── provisioning/                        # Hetzner setup notes, not IaC yet
│
├── docs/
│   └── rules/                                # this directory
│
└── research & planning/                      # locked decisions, do not restructure
```

---

## 2. Naming conventions

| Type             | Convention                                                      | Example                                        |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| Package          | kebab-case                                                      | `mcp-server`, `worker`, `shared`               |
| Source file      | kebab-case.ts                                                   | `self-hosted-provider.ts`                      |
| Zod schema file  | kebab-case.schema.ts (in `shared/src/schemas/`)                 | `view-page.schema.ts`                          |
| Interface / type | PascalCase                                                      | `BrowserProvider`, `ResultEnvelope`            |
| Enum             | PascalCase, members SCREAMING_SNAKE_CASE                        | `ErrorCode.SSRF_BLOCKED`                       |
| Constant         | SCREAMING_SNAKE_CASE, defined once in `shared/src/constants.ts` | `JOB_DEADLINE_MS`                              |
| Function         | camelCase verb + noun                                           | `verifyBearerToken`, `runStealthLadder`        |
| Env var          | SCREAMING_SNAKE_CASE, package-prefixed where ambiguous          | `MCP_SERVER_PORT`, `WORKER_RENDER_CONCURRENCY` |

---

## 3. File placement decision tree

```
Does it define a shape both mcp-server and worker need (schema, envelope, error code, job type)?
  YES -> packages/shared/src/

Does it touch Patchright/Chrome directly?
  YES -> packages/worker/src/providers/self-hosted-provider.ts ONLY
         (nowhere else may import patchright — route through BrowserProvider)

Does it verify a token, check SSRF pre-flight, check quota, or speak MCP protocol?
  YES -> packages/mcp-server/src/

Does it run inside the render pipeline (ladder, classifier, extractor, image encode)?
  YES -> packages/worker/src/

Is it an AUTHENTICATED human-facing page or action (login, API key management, billing link-out, quota view)?
  YES -> packages/dashboard/ (never mcp-server — see 01-architecture.md §1)

Is it PUBLIC marketing/informational content (landing page, pricing, FAQ) — no auth, no app state?
  YES -> packages/website/ (never dashboard — different app, different constraints; see research & planning/06-brand-identity.md)

Is it a Dockerfile, compose file, or provisioning note?
  YES -> infra/

Is it a rule, decision doc, or open question?
  YES -> docs/rules/ (enforceable rule) or research & planning/ (rationale/decision record)
```

---

## 4. Barrel exports

Only `packages/shared/src/index.ts` is a barrel file, and it only re-exports the intentionally public surface (schemas, `ResultEnvelope`, `ErrorCode`, job types, constants). `mcp-server` and `worker` import from `@ocular/shared`, never from `@ocular/shared/src/internal-file`.

No barrel files inside `mcp-server/src/` or `worker/src/` subdirectories — import the specific file.

---

## 5. Package manager and workspace tooling

- **npm workspaces.** Root `package.json` declares `"workspaces": ["packages/*"]` — no separate workspace-config file needed (unlike pnpm/yarn).
- Cross-package imports: declare `"@ocular/shared": "*"` in the dependent package's `package.json`. npm (7+) resolves same-named workspace packages via symlink automatically — no `workspace:` protocol prefix like pnpm/yarn use.
- Run workspace-scoped commands with `npm run <script> --workspace=packages/<name>` (or `-w packages/<name>`); run a script in every workspace with `npm run <script> --workspaces`.
- Install a dependency into one package with `npm install <pkg> --workspace=packages/<name>`, not by `cd`-ing into the package directory.
- Use `package-lock.json` at the repo root (committed); no per-package lockfiles.
- One `tsconfig.base.json` at root; each package extends it. No per-package duplicate compiler options beyond `outDir`/`rootDir`.
- Node LTS (even-numbered major) pinned in `.nvmrc` and `engines` in every `package.json` — required because `worker` depends on native addons (`sharp`, Patchright's bundled Chromium) that are sensitive to Node ABI changes.

---

## 6. Bootstrap templates

### New Zod schema (in `shared`):

```typescript
// packages/shared/src/schemas/view-page.schema.ts
import { z } from 'zod';

export const viewPageInputSchema = z.object({
  url: z.string().url(),
  detail: z.enum(['low', 'balanced', 'high']).default('balanced'),
  full_page: z.boolean().default(false),
  viewport: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
});

export type ViewPageInput = z.infer<typeof viewPageInputSchema>;
```

### New MCP tool handler (in `mcp-server`):

```typescript
// packages/mcp-server/src/tools/view-page.ts
import { viewPageInputSchema } from '@ocular/shared';
import { enqueueAndAwait } from '../queue/enqueue';

export async function handleViewPage(rawArgs: unknown, ctx: RequestContext) {
  const args = viewPageInputSchema.parse(rawArgs); // throws on invalid input — caught upstream
  return enqueueAndAwait({
    tool: 'view_page',
    args,
    account: ctx.account,
    requestId: ctx.requestId,
  });
}
```

### New extractor (in `worker`):

```typescript
// packages/worker/src/extractors/screenshot.ts
import type { Page } from 'patchright';

export async function extractScreenshot(page: Page, opts: { fullPage: boolean }): Promise<Buffer> {
  return page.screenshot({ fullPage: opts.fullPage, type: 'png' });
}
```

---

## 7. Tooling (lint, format, type-check)

- **TypeScript**: `strict: true` in `tsconfig.base.json`, no exceptions per-package. `noUncheckedIndexedAccess: true` — extractor/DOM-walking code touches a lot of indexed/optional data from untrusted pages, and this catches a real class of bug there.
- **ESLint**: `typescript-eslint` (flat config, `eslint.config.js` per package extending a root config). `no-restricted-imports` is configured per package to enforce the boundaries in `01-architecture.md` §1 — e.g. `worker`'s config blocks importing `patchright` from anywhere except `providers/self-hosted-provider.ts`; `shared`'s config blocks importing `ioredis`, `bullmq`, `fastify`, `patchright`, `next`.
- **Prettier**: one root `.prettierrc`, no per-package overrides.
- **Pre-commit**: `lint-staged` running ESLint + Prettier on staged files (via a git hook), not a separate manual step.

## 8. Starting dependency list (adjust as milestones demand — not exhaustive)

```bash
# Root — workspace + shared dev tooling
npm install -D typescript eslint prettier lint-staged simple-git-hooks vitest @vitest/coverage-v8 tsx

# packages/shared — near-zero runtime deps by design (03-shared-contracts.md §5)
npm install zod --workspace=packages/shared

# packages/mcp-server
npm install fastify @modelcontextprotocol/sdk ioredis bullmq pg jose pino zod --workspace=packages/mcp-server

# packages/worker
npm install patchright bullmq ioredis sharp pino undici --workspace=packages/worker

# packages/dashboard (Next.js, deployed to Vercel per research & planning/02 §17)
npm install next react react-dom @workos-inc/authkit-nextjs @neondatabase/serverless zod --workspace=packages/dashboard
# + Bachs's official Node SDK once its published package name is confirmed during M5
```

**Rule:** a package only declares the dependencies it actually imports — `shared`'s near-empty dependency list (§5 of `03-shared-contracts.md`) is enforced by this, not just convention.

**Rule — two different Postgres drivers, deliberately:** `mcp-server` uses `pg` (standard TCP driver with a real connection pool) because it's a long-lived Node process on Hetzner. `dashboard` uses `@neondatabase/serverless` (HTTP/WebSocket-based) because it runs as short-lived Vercel serverless functions, where holding a pooled TCP connection per invocation doesn't work — this is Neon's own recommended driver for exactly that runtime. Neither package pulls in a Supabase-style bundled SDK (auth/storage/realtime) — Neon is deliberately just a Postgres database; AuthKit already owns auth (see `research & planning/02` §16).

**Rule:** before adding a new dependency, check whether it duplicates something Fastify, Next.js, or Node's built-ins (`fetch`, `crypto`, `node:test`) already provide — per the global coding-style rule against speculative dependencies (YAGNI). `axios`/`node-fetch` are explicitly not needed; `undici`(Node's own fetch implementation, exposed as a direct dependency only where fine-grained timeout/dispatcher control is needed, e.g. `UnblockerClient`) is the one exception.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
