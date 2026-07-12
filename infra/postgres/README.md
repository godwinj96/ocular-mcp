# Ocular — Postgres (Neon)

`migrations/0001_init.sql` is the initial schema: `accounts` (OAuth-subject ↔ plan mapping, per `docs/rules/04-mcp-server-and-auth.md` §3 and `docs/rules/11-billing-and-quota.md` §3) and `static_api_keys` (headless/CI auth path, per `research & planning/05-user-flows.md` Flow 4).

## Applying it

**Decision: Drizzle ORM**, not `node-pg-migrate`. `node-pg-migrate` is only a migration runner — no query builder, no type safety on reads/writes, so `mcp-server` would still hand-write raw SQL for every query. Drizzle gives a TS-first schema with type-safe queries and `drizzle-kit` for migration generation, and — the deciding factor here — it works against both Postgres drivers this repo already commits to (`pg` for `mcp-server`, `@neondatabase/serverless` for `dashboard`, per `docs/rules/02-repo-structure.md` §8) from the same schema definitions, so the `accounts`/`static_api_keys` shape isn't duplicated across packages.

Until the Drizzle schema + `drizzle-kit` migration are wired up (M1), apply this file directly:

```bash
psql "$NEON_DATABASE_URL" -f infra/postgres/migrations/0001_init.sql
```

or paste its contents into Neon's SQL editor in the console. Once Drizzle is wired up, this raw SQL file becomes the seed for the first `drizzle-kit` migration rather than the source of truth going forward.

## Notes

- `gen_random_uuid()` requires the `pgcrypto` extension, enabled by the first line of the migration — Neon allows this without extra permissions.
- `accounts.subscription_status` distinguishes `none` (signed in, never subscribed) from `canceled` (subscribed, then lapsed) — this exists specifically to support the "lapsed vs. never-subscribed" messaging distinction tracked as an open, non-blocking item in `research & planning/04-open-questions.md`, even though that distinction isn't wired into `mcp-server`'s error messages yet.
- `static_api_keys` never stores a raw key — only `key_hash` (hash it before writing) and `key_prefix` (first ~8 chars, safe to display in the dashboard's key list per `docs/rules/12-environment-and-secrets.md` §4).
- Rows in both tables are never hard-deleted by application code (see `docs/rules/11-billing-and-quota.md` §3 — an account is deactivated, not removed, so `UNAUTHORIZED` resolution and historical/audit lookups keep working). `on delete cascade` on `static_api_keys.account_id` is a DB-level safety default, not an invitation to build an account-deletion feature — none is planned for Phase 1.
