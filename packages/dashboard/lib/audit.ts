// The account audit trail.
//
// SCOPE IS THE DESIGN. These are things done TO the account — a key created or
// revoked, a plan changed, a machine connected. Never what was captured. A
// capture log would be a record of which localhost pages and (phase 2) which
// authenticated pages a developer looked at, which is precisely the artefact
// CLAUDE.md's threat model exists to prevent, and it would sit in a database we
// operate rather than on their machine.
//
// `detail` holds key prefixes, plan slugs, machine labels, status strings. It
// must never hold a raw key, a token, or a capture target. `actor` is
// user/worker/system, not an IP — an audit trail that logs IPs is a location
// history, which is not what an audit trail was asked to be.
import { sql } from './postgres';

export type AuditKind =
  | 'key.created'
  | 'key.revoked'
  | 'plan.changed'
  | 'subscription.status_changed'
  | 'worker.connected'
  | 'worker.disconnected'
  | 'session.signed_in'
  // Admin-driven mutations (infra/postgres/migrations/0003) — kept distinct
  // from their customer-driven equivalents above so the trail can tell
  // "the customer did this" from "an admin did this to them".
  | 'account.banned'
  | 'account.unbanned'
  | 'plan.changed_by_admin'
  | 'role.changed'
  // Recorded, not just redirected -- see app/billing/checkout/route.ts's
  // header for why the ?checkout=unavailable redirect alone left the
  // Analytics page's "failed checkout" metric with no data behind it.
  | 'checkout.unavailable';

export type AuditActor = 'user' | 'worker' | 'system';

export interface AuditEvent {
  id: string;
  kind: AuditKind;
  detail: Record<string, unknown>;
  actor: AuditActor;
  createdAt: string;
}

interface AuditRow {
  id: string;
  kind: AuditKind;
  detail: Record<string, unknown>;
  actor: AuditActor;
  created_at: string;
}

export async function recordAuditEvent(
  accountId: string,
  kind: AuditKind,
  detail: Record<string, unknown> = {},
  actor: AuditActor = 'user',
): Promise<void> {
  await sql`
    insert into audit_events (account_id, kind, detail, actor)
    values (${accountId}, ${kind}, ${JSON.stringify(detail)}::jsonb, ${actor})
  `;
}

export async function listAuditEvents(accountId: string, limit = 50): Promise<AuditEvent[]> {
  const rows = (await sql`
    select id, kind, detail, actor, created_at
    from audit_events
    where account_id = ${accountId}
    order by created_at desc
    limit ${limit}
  `) as AuditRow[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    detail: row.detail,
    actor: row.actor,
    createdAt: row.created_at,
  }));
}

export interface CrossAccountAuditEvent extends AuditEvent {
  accountEmail: string;
}

interface CrossAccountAuditRow extends AuditRow {
  account_email: string;
}

export interface AuditFilters {
  kind?: AuditKind;
  actor?: AuditActor;
  /** Substring match against the account's email — how an admin finds "this person's" events without knowing the account id. */
  email?: string;
}

// The admin-wide view — same table listAuditEvents reads, unscoped, with the
// account's email joined in so a row is identifiable without a second lookup.
// Cursor-paginated on (created_at, id) rather than offset: an admin log is
// append-only and grows continuously, so an offset would skip or repeat rows
// as new events land between page loads.
export async function listAuditEventsAcrossAccounts(
  filters: AuditFilters,
  limit = 50,
  before?: { createdAt: string; id: string },
): Promise<CrossAccountAuditEvent[]> {
  const rows = (await sql`
    select e.id, e.kind, e.detail, e.actor, e.created_at, a.email as account_email
    from audit_events e
    join accounts a on a.id = e.account_id
    where (${filters.kind ?? null}::audit_event_kind is null or e.kind = ${filters.kind ?? null})
      and (${filters.actor ?? null}::text is null or e.actor = ${filters.actor ?? null})
      and (${filters.email ?? null}::text is null or a.email ilike ${filters.email ? '%' + filters.email + '%' : null})
      and (
        ${before?.createdAt ?? null}::timestamptz is null
        or (e.created_at, e.id) < (${before?.createdAt ?? null}::timestamptz, ${before?.id ?? null}::uuid)
      )
    order by e.created_at desc, e.id desc
    limit ${limit}
  `) as CrossAccountAuditRow[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    detail: row.detail,
    actor: row.actor,
    createdAt: row.created_at,
    accountEmail: row.account_email,
  }));
}

// One sentence per event kind, written for the person who owns the account
// rather than for an operator reading a log. The raw enum is never shown --
// "key.revoked" is a database value, not a thing a user should have to parse.
export function describeAuditEvent(event: AuditEvent): string {
  const d = event.detail;
  switch (event.kind) {
    case 'key.created':
      return d.label ? `Key created — ${String(d.label)}` : 'Key created';
    case 'key.revoked':
      return d.prefix ? `Key revoked — ${String(d.prefix)}…` : 'Key revoked';
    case 'plan.changed':
      return `Plan changed to ${String(d.plan ?? 'a new plan')}`;
    case 'subscription.status_changed':
      return `Subscription is now ${String(d.status ?? 'updated')}`;
    case 'account.banned':
      return d.reason ? `Account banned — ${String(d.reason)}` : 'Account banned';
    case 'account.unbanned':
      return 'Account unbanned';
    case 'plan.changed_by_admin':
      return `Plan changed to ${String(d.plan ?? 'a new plan')} by an admin`;
    case 'role.changed':
      return `Role changed to ${String(d.role ?? 'a new role')}`;
    case 'checkout.unavailable':
      return d.plan ? `Checkout unavailable — ${String(d.plan)}` : 'Checkout unavailable';
    case 'worker.connected':
      return d.label ? `${String(d.label)} connected` : 'A machine connected';
    case 'worker.disconnected':
      return d.label ? `${String(d.label)} stopped reporting` : 'A machine stopped reporting';
    case 'session.signed_in':
      return 'Signed in';
  }
}
