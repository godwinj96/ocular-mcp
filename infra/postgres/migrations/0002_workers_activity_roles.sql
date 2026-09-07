-- Ocular — workers, activity, capture counters, and account roles.
--
-- WHY THIS EXISTS. The dashboard's headline question is "is the thing I paid
-- for running right now?" — and before this migration that was not merely
-- unshown, it was unanswerable: 0001 has accounts and static_api_keys and
-- nothing else. There is no record that a machine exists, ever checked in, or
-- ever captured anything.
--
-- PRIVACY BOUNDARY, and it is the important part of this file. Everything here
-- is COUNTS AND ACCOUNT ACTIONS. No capture ever records what was looked at —
-- no URL, no title, no thumbnail, no per-capture timestamp. Local captures
-- include localhost and (phase 2) authenticated pages, and CLAUDE.md's promise
-- is that authenticated sessions never leave the user's machine. A daily
-- integer per account per path is the most that can be stored without building
-- exactly the exfiltration surface the threat model exists to prevent.

create type worker_kind as enum ('local', 'cloud');

-- One row per machine running a local worker.
--
-- Identity is a client-generated uuid persisted in the worker's own config
-- directory, NOT a hardware id or anything derived from the machine — a stable
-- random token the user could delete. The label is whatever the OS reports as
-- the hostname; it exists so a user with two machines can tell them apart, and
-- it is the only descriptive thing here.
create table workers (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts (id) on delete cascade,
  worker_id       text not null,   -- client-generated, stable across restarts
  label           text,            -- hostname; nullable — an unlabelled worker still works
  version         text,            -- supervisor version, for support
  platform        text,            -- 'darwin' | 'win32' | 'linux'
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),

  -- Set when the heartbeat is a real timer tick rather than a capture-driven
  -- subscription check. Before the supervisor grew a heartbeat, an idle worker
  -- and an uninstalled one were indistinguishable — both silent — so "idle" as
  -- a HEALTHY state could not be told from "gone". This column is what makes
  -- that distinction real rather than inferred.
  heartbeat_at    timestamptz
);

create unique index workers_account_worker_key on workers (account_id, worker_id);
create index workers_account_last_seen_idx on workers (account_id, last_seen_at desc);

-- Daily capture counts, split by path. Two integers per account per day.
--
-- The cloud count already exists in Redis for quota enforcement; this is the
-- durable, historical copy, and it is the ONLY place a local capture is ever
-- counted. Without a local counter the dashboard can only ever show cloud
-- usage, which for a user whose entire workload is localhost reads as
-- "40 / 40 left" forever — i.e. "I pay for something I never use", which is
-- the renewal-moment churn mechanism.
create table capture_counters (
  account_id    uuid not null references accounts (id) on delete cascade,
  day           date not null,              -- UTC day; matches the allowance reset boundary
  local_count   integer not null default 0,
  cloud_count   integer not null default 0,
  primary key (account_id, day)
);

create index capture_counters_account_day_idx on capture_counters (account_id, day desc);

-- Account-level audit trail.
--
-- SCOPE, deliberately: things done TO the account — a key created or revoked,
-- a plan changed, a machine connected, a sign-in. Never what was captured. The
-- boundary is the same one capture_counters draws, and for the same reason.
create type audit_event_kind as enum (
  'key.created',
  'key.revoked',
  'plan.changed',
  'subscription.status_changed',
  'worker.connected',
  'worker.disconnected',
  'session.signed_in'
);

create table audit_events (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts (id) on delete cascade,
  kind         audit_event_kind not null,

  -- Free-form structured detail, and a place it is easy to get this wrong:
  -- it holds key prefixes, plan slugs, machine labels and status strings.
  -- It must never hold a capture target, a raw key, or a token.
  detail       jsonb not null default '{}'::jsonb,

  -- Who/what caused it. 'user' from the dashboard, 'worker' from a machine,
  -- 'system' from a webhook. Not an IP address: an audit trail that logs IPs
  -- is a location history, which is not what was asked for.
  actor        text not null default 'user',
  created_at   timestamptz not null default now()
);

create index audit_events_account_created_idx on audit_events (account_id, created_at desc);

-- Roles. Two values, and the second one is for support, not for teams: an
-- admin can look up an account and see its subscription state to help someone
-- who is stuck. There is no organization object here and no member management
-- — Ocular is one developer per account, and inventing a team product the PRD
-- does not have would be inventing a migration to undo later.
create type account_role as enum ('user', 'admin');

alter table accounts add column role account_role not null default 'user';
