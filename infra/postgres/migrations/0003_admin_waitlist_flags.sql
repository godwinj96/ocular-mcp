-- Ocular — admin mutations, feature flags, and the waitlist.
--
-- Built for the admin sub-app (DEVLOG.md, Session 34 brief §2, built out in
-- Session 35): user management needs a ban state, admin-driven plan changes
-- and role promotion need their own audit_event_kind values distinct from
-- the customer-driven equivalents already in 0002 (so the audit trail can
-- tell "the customer changed their own plan via Bachs checkout" from
-- "an admin changed it for them"), and the waitlist toggle needs somewhere
-- to live that isn't a hardcoded env var an admin can't flip without a
-- redeploy.

-- A ban blocks BOTH auth paths this product has (AuthKit OAuth session
-- resolution AND static API keys) — see mcp-server's resolve-account.ts and
-- verify-jwt.ts/verify-static-key.ts, which both resolve through
-- accounts-repository.ts's findByOauthSubject/findByApiKeyHash. Both queries
-- got a `banned_at is null` guard in the SAME change that added this column
-- (not left as follow-up work — a ban with no enforcement wired through is
-- cosmetic, and shipping a "Ban" button that doesn't ban anyone is worse
-- than not shipping one).
alter table accounts add column banned_at timestamptz;

alter type audit_event_kind add value 'account.banned';
alter type audit_event_kind add value 'account.unbanned';
alter type audit_event_kind add value 'plan.changed_by_admin';
alter type audit_event_kind add value 'role.changed';
-- Added when building the Analytics page's "failed checkout" metric (kept
-- worthwhile by that page's own research): app/billing/checkout/route.ts
-- redirected to `?checkout=unavailable` without ever persisting the event,
-- so there was no data behind the metric this enum value now backs.
alter type audit_event_kind add value 'checkout.unavailable';

-- Minimal key/value store for runtime toggles the website (a static Vite SPA
-- with no server of its own) needs to read without a rebuild+redeploy. One
-- row exists today (waitlist_mode); the shape is generic on purpose rather
-- than a dedicated boolean column, since the next toggle an admin asks for
-- shouldn't need its own migration.
create table feature_flags (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Public signups while cloud hosting isn't live yet. Deliberately minimal —
-- email only, no name/company/use-case fields a pre-launch waitlist doesn't
-- need and that would just be more PII to protect for zero product benefit.
--
-- invited_at is the one addition past that minimum, and it's there for a
-- concrete reason: without it, every CSV export shows the whole list again
-- with no way to tell who's already been emailed once cloud hosting ships —
-- the founder would end up tracking that by hand in a spreadsheet outside
-- the database, which a single nullable column avoids. Set by hand from the
-- admin UI when a batch is emailed; null means not yet invited.
create table waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  created_at  timestamptz not null default now(),
  invited_at  timestamptz
);

-- Case-insensitive: the same person retrying with different capitalization
-- should not occupy two rows.
create unique index waitlist_email_key on waitlist (lower(email));
