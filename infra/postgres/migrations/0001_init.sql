-- Ocular — initial Postgres schema (Neon)
-- Scope: accounts (OAuth-subject <-> plan mapping) + static API keys.
-- See docs/rules/03-shared-contracts.md, docs/rules/04-mcp-server-and-auth.md,
-- docs/rules/11-billing-and-quota.md, and research & planning/05-user-flows.md
-- (Flows 1, 2, 4, 9) for the behavior this schema supports.

create extension if not exists pgcrypto; -- gen_random_uuid()

create type subscription_status as enum (
  'none',      -- signed in via AuthKit, never completed Bachs checkout (Flow 1 step 8)
  'active',
  'past_due',
  'canceled'   -- kept distinct from 'none' so UNAUTHORIZED messaging can eventually
               -- distinguish "never subscribed" from "lapsed" — see 04-open-questions.md
);

-- One row per human, created on first successful AuthKit login (not on first tool call —
-- see docs/rules/04-mcp-server-and-auth.md §3 step 3: a token with no matching row here
-- is UNAUTHORIZED, never a default quota).
create table accounts (
  id                    uuid primary key default gen_random_uuid(),
  oauth_subject_id      text not null,        -- AuthKit JWT `sub` claim
  email                 text not null,        -- from AuthKit, for dashboard/support display only
  bachs_customer_id     text,                 -- null until Bachs checkout completes (Flow 2 step 4-6)
  plan                  text,                 -- null until an active plan exists; plan slug otherwise
  subscription_status   subscription_status not null default 'none',
  quota_reset_at        timestamptz,          -- next monthly quota reset; null while status = 'none'
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index accounts_oauth_subject_id_key on accounts (oauth_subject_id);
-- Partial unique index: many rows will have a null bachs_customer_id (pre-checkout),
-- and Postgres treats NULLs as distinct for uniqueness, but this is explicit for clarity.
create unique index accounts_bachs_customer_id_key on accounts (bachs_customer_id)
  where bachs_customer_id is not null;

-- Static API keys — headless/CI auth path. See docs/rules/04-mcp-server-and-auth.md §2
-- and research & planning/05-user-flows.md Flow 4. The raw key is shown to the user
-- exactly once at generation time and is NEVER stored — only its hash.
create table static_api_keys (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  key_hash      text not null,   -- sha256 (or bcrypt) of the raw key — raw key never stored
  key_prefix    text not null,   -- first ~8 chars of the raw key, shown in the dashboard list
                                  -- so a user can tell keys apart without re-exposing the secret
  label         text,            -- optional user-given name; nullable, not required by Phase 1 scope
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,     -- null = active; set on revoke, never deleted (audit trail)
  last_used_at  timestamptz
);

create unique index static_api_keys_key_hash_key on static_api_keys (key_hash);
create index static_api_keys_account_id_idx on static_api_keys (account_id);

-- "Active key for this account" is the query mcp-server's verify-static-key.ts runs on
-- every request — index the common case explicitly.
create index static_api_keys_active_idx on static_api_keys (account_id)
  where revoked_at is null;
