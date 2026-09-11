// User management — beyond the old single-lookup page: filtered/paginated
// list, with mutations available from a per-account detail panel rather
// than inline row actions (see components/admin/user-detail-panel.tsx for
// why). The old page's "Read only" notice is gone — the founder explicitly
// lifted that constraint, and every mutation now writes an audit event
// instead.
import { PLAN_SLUGS } from '@ocular/shared';
import { listAccounts } from '../../../../lib/accounts';
import { PageHeader } from '../../../../components/ui/page-header';
import { Table, Th, Td, Tr, Blank } from '../../../../components/ui/table';
import { Lamp } from '../../../../components/ui/lamp';
import { EmptyState } from '../../../../components/ui/empty-state';
import { ButtonLink } from '../../../../components/ui/button';
import { formatDay, formatRelative } from '../../../../lib/format';
import { workerState } from '../../../../lib/workers';
import { UserDetailPanel } from '../../../../components/admin/user-detail-panel';

const PAGE_SIZE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const str = (v: string | string[] | undefined): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;

  const email = str(params.q);
  const subscriptionStatus = str(params.status) as
    'none' | 'active' | 'past_due' | 'canceled' | undefined;
  const role = str(params.role) as 'user' | 'admin' | undefined;
  const selectedAccountId = str(params.account);

  const beforeCreatedAt = str(params.beforeCreatedAt);
  const beforeId = str(params.beforeId);

  // Fetch one extra row to know whether a "Next" page actually exists,
  // without a separate count query.
  const rows = await listAccounts(
    { email, subscriptionStatus, role },
    PAGE_SIZE + 1,
    beforeCreatedAt && beforeId ? { createdAt: beforeCreatedAt, id: beforeId } : undefined,
  );
  const hasNext = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];

  const selected = selectedAccountId ? page.find((a) => a.id === selectedAccountId) : undefined;

  const nextParams = new URLSearchParams();
  if (email) nextParams.set('q', email);
  if (subscriptionStatus) nextParams.set('status', subscriptionStatus);
  if (role) nextParams.set('role', role);
  if (last) {
    nextParams.set('beforeCreatedAt', last.createdAt);
    nextParams.set('beforeId', last.id);
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" deck="Search, filter, and manage every account." />

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          type="search"
          defaultValue={email}
          placeholder="someone@example.com"
          className="h-9 w-full max-w-[280px] rounded border border-rule-mark bg-surface-elevated px-3 text-[13px] text-text-primary placeholder:text-text-quaternary"
        />
        <select
          name="status"
          defaultValue={subscriptionStatus ?? ''}
          className="h-9 rounded border border-rule-mark bg-surface-elevated px-3 font-mono text-[13px] text-text-primary"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
          <option value="none">None</option>
        </select>
        <select
          name="role"
          defaultValue={role ?? ''}
          className="h-9 rounded border border-rule-mark bg-surface-elevated px-3 font-mono text-[13px] text-text-primary"
        >
          <option value="">Any role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-full border border-rule-mark px-4 font-brand text-[13px] font-semibold text-text-primary transition-colors duration-150 ease-base hover:border-accent hover:text-accent"
        >
          Filter
        </button>
      </form>

      <div className="mt-stack-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className={selected ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {page.length === 0 ? (
            <EmptyState title="No accounts match" description="Try a different search or filter." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Role</Th>
                  <Th>Signed up</Th>
                  <Th>Last report</Th>
                </tr>
              </thead>
              <tbody>
                {page.map((row) => {
                  const rowParams = new URLSearchParams(nextParams);
                  rowParams.delete('beforeCreatedAt');
                  rowParams.delete('beforeId');
                  rowParams.set('account', row.id);
                  return (
                    <Tr key={row.id} muted={row.bannedAt !== null}>
                      <Td mono>
                        <a href={`?${rowParams.toString()}`} className="hover:text-accent">
                          {row.email}
                        </a>
                      </Td>
                      <Td mono>{row.plan ?? <Blank />}</Td>
                      <Td>
                        <Lamp
                          state={
                            row.subscriptionStatus === 'active'
                              ? 'live'
                              : row.subscriptionStatus === 'past_due'
                                ? 'caution'
                                : row.subscriptionStatus === 'canceled'
                                  ? 'fault'
                                  : 'inactive'
                          }
                          label={row.bannedAt ? 'banned' : row.subscriptionStatus}
                        />
                      </Td>
                      <Td mono>{row.role}</Td>
                      <Td mono>{formatDay(row.createdAt)}</Td>
                      <Td mono>
                        {row.lastSeenAt ? (
                          <>
                            {formatRelative(row.heartbeatAt ?? row.lastSeenAt)}
                            <span className="ml-2 text-text-quaternary">
                              {workerState({
                                lastSeenAt: row.lastSeenAt,
                                heartbeatAt: row.heartbeatAt,
                              })}
                            </span>
                          </>
                        ) : (
                          <Blank />
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {/* Next-only pagination: this is an admin list, not a public
              archive, and a cursor stack for Prev needs client state a
              server component doesn't have cheaply. Revisit if the account
              count ever makes "start over and filter tighter" a real
              burden. */}
          {hasNext && (
            <div className="mt-stack-3 flex justify-end">
              <ButtonLink href={`?${nextParams.toString()}`} variant="quiet">
                Next →
              </ButtonLink>
            </div>
          )}
        </div>

        {selected && (
          <div>
            <UserDetailPanel account={selected} planOptions={PLAN_SLUGS} />
          </div>
        )}
      </div>
    </>
  );
}
