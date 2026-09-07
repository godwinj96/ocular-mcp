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
  | 'session.signed_in';

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
    case 'worker.connected':
      return d.label ? `${String(d.label)} connected` : 'A machine connected';
    case 'worker.disconnected':
      return d.label ? `${String(d.label)} stopped reporting` : 'A machine stopped reporting';
    case 'session.signed_in':
      return 'Signed in';
  }
}
