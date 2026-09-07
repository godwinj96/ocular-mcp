// The admin-wide audit view — same audit_events table lib/audit.ts already
// reads per-account, unscoped, with filtering. Shows the RAW kind (e.g.
// "key.revoked") rather than describeAuditEvent()'s human sentence: that
// function's own comment scopes its rendering to "the person who owns the
// account", and an operator reading a cross-account log is exactly the case
// it names as the exception.
import { listAuditEventsAcrossAccounts } from '../../../lib/audit';
import type { AuditKind, AuditActor } from '../../../lib/audit';
import { PageHeader } from '../../../components/ui/page-header';
import { Table, Th, Td, Tr } from '../../../components/ui/table';
import { EmptyState } from '../../../components/ui/empty-state';
import { ButtonLink } from '../../../components/ui/button';
import { formatTimestamp } from '../../../lib/format';

const PAGE_SIZE = 50;

const AUDIT_KINDS: AuditKind[] = [
  'key.created',
  'key.revoked',
  'plan.changed',
  'subscription.status_changed',
  'worker.connected',
  'worker.disconnected',
  'session.signed_in',
  'account.banned',
  'account.unbanned',
  'plan.changed_by_admin',
  'role.changed',
  'checkout.unavailable',
];

function detailSummary(detail: Record<string, unknown>): string {
  const entries = Object.entries(detail);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const str = (v: string | string[] | undefined): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;

  const kind = str(params.kind) as AuditKind | undefined;
  const actor = str(params.actor) as AuditActor | undefined;
  const email = str(params.q);
  const beforeCreatedAt = str(params.beforeCreatedAt);
  const beforeId = str(params.beforeId);

  const rows = await listAuditEventsAcrossAccounts(
    { kind, actor, email },
    PAGE_SIZE + 1,
    beforeCreatedAt && beforeId ? { createdAt: beforeCreatedAt, id: beforeId } : undefined,
  );
  const hasNext = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];

  const nextParams = new URLSearchParams();
  if (kind) nextParams.set('kind', kind);
  if (actor) nextParams.set('actor', actor);
  if (email) nextParams.set('q', email);
  if (last) {
    nextParams.set('beforeCreatedAt', last.createdAt);
    nextParams.set('beforeId', last.id);
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        deck="Every account-changing event, across all accounts."
      />

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          type="search"
          defaultValue={email}
          placeholder="Account email"
          className="h-9 w-full max-w-[240px] rounded border border-rule-mark bg-surface-elevated px-3 text-[13px] text-text-primary placeholder:text-text-quaternary"
        />
        <select
          name="kind"
          defaultValue={kind ?? ''}
          className="h-9 rounded border border-rule-mark bg-surface-elevated px-3 font-mono text-[13px] text-text-primary"
        >
          <option value="">Any kind</option>
          {AUDIT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          name="actor"
          defaultValue={actor ?? ''}
          className="h-9 rounded border border-rule-mark bg-surface-elevated px-3 font-mono text-[13px] text-text-primary"
        >
          <option value="">Any actor</option>
          <option value="user">user</option>
          <option value="worker">worker</option>
          <option value="system">system</option>
        </select>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-full border border-rule-mark px-4 font-brand text-[13px] font-semibold text-text-primary transition-colors duration-150 ease-base hover:border-accent hover:text-accent"
        >
          Filter
        </button>
      </form>

      <div className="mt-stack-4">
        {page.length === 0 ? (
          <EmptyState title="No events match" description="Try a different filter." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Kind</Th>
                <Th>Actor</Th>
                <Th>Detail</Th>
                <Th>Timestamp</Th>
              </tr>
            </thead>
            <tbody>
              {page.map((event) => (
                <Tr key={event.id}>
                  <Td mono>{event.accountEmail}</Td>
                  <Td mono>{event.kind}</Td>
                  <Td mono className="text-text-tertiary">
                    {event.actor}
                  </Td>
                  <Td className="max-w-[320px] truncate text-[11.5px] text-text-tertiary">
                    {detailSummary(event.detail)}
                  </Td>
                  {/* formatTimestamp, not formatRelative: an audit log is
                      exactly the page ops leave open, and relative time
                      silently rots on an open tab -- format.ts's own rule. */}
                  <Td mono>{formatTimestamp(event.createdAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {hasNext && (
          <div className="mt-stack-3 flex justify-end">
            <ButtonLink href={`?${nextParams.toString()}`} variant="quiet">
              Next →
            </ButtonLink>
          </div>
        )}
      </div>
    </>
  );
}
