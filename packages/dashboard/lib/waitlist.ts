// The waitlist — public signups while cloud hosting isn't live, plus the
// admin-side list/export. See infra/postgres/migrations/0003 for the schema
// and its comment on why `invited_at` exists (CSV exports need a way to tell
// who's already been emailed once cloud hosting ships).
import { sql } from './postgres';

export interface WaitlistEntry {
  id: string;
  email: string;
  createdAt: string;
  invitedAt: string | null;
}

interface WaitlistRow {
  id: string;
  email: string;
  created_at: string;
  invited_at: string | null;
}

function toEntry(row: WaitlistRow): WaitlistEntry {
  return { id: row.id, email: row.email, createdAt: row.created_at, invitedAt: row.invited_at };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddToWaitlistResult =
  { ok: true } | { ok: false; reason: 'invalid_email' | 'already_joined' };

// Public path — see app/api/public/waitlist/route.ts. Validates shape here
// (not just at the route boundary) so any future caller of this function
// gets the same guarantee without re-deriving it.
export async function addToWaitlist(rawEmail: string): Promise<AddToWaitlistResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return { ok: false, reason: 'invalid_email' };
  }

  try {
    await sql`insert into waitlist (email) values (${email})`;
    return { ok: true };
  } catch (error) {
    // unique violation on lower(email) — someone already joined with this
    // address. Treated as a soft success from the caller's perspective (see
    // the route handler), not surfaced as a hard error to the person typing.
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return { ok: false, reason: 'already_joined' };
    }
    throw error;
  }
}

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  const rows = (await sql`
    select id, email, created_at, invited_at from waitlist order by created_at asc
  `) as WaitlistRow[];
  return rows.map(toEntry);
}

export async function markInvited(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql`update waitlist set invited_at = now() where id = any(${ids}::uuid[])`;
}

// CSV, not real .xlsx — Excel opens CSV natively, and a spreadsheet library
// dependency for a feature this small would be the wrong trade. Quoted per
// RFC 4180 (only email/timestamp fields, so quoting is defensive rather than
// load-bearing today, but it's the same cost either way to do it right).
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function waitlistToCsv(entries: WaitlistEntry[]): string {
  const header = ['email', 'joined_at', 'invited_at'].join(',');
  const rows = entries.map((e) =>
    [csvField(e.email), csvField(e.createdAt), csvField(e.invitedAt ?? '')].join(','),
  );
  return [header, ...rows].join('\r\n') + '\r\n';
}
