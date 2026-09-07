// Admin — support, not a team product.
//
// RBAC here is one bit: user or admin. There is no organization object, no
// invites, no seats, no per-resource permissions, because Ocular is one
// developer per account and building the machinery for teams the PRD does not
// have would mean maintaining a migration path to undo later.
//
// What it is FOR: someone writes in saying "I paid and it isn't working", and
// this answers that in one lookup -- do they have an active subscription, has a
// machine ever checked in, when did it last report. Read-only by design: an
// admin can see state, not change it. A support tool that can mutate a
// stranger's billing is a support tool that will, eventually, mutate the wrong
// stranger's billing.
import { notFound } from 'next/navigation';
import { getCurrentAccount } from '../../lib/current-account';
import { sql } from '../../lib/postgres';
import { PageHeader } from '../../components/ui/page-header';
import { Table, Th, Td, Tr, Blank } from '../../components/ui/table';
import { Notice } from '../../components/ui/notice';
import { EmptyState } from '../../components/ui/empty-state';
import { formatRelative, formatDay } from '../../lib/format';
import { workerState } from '../../lib/workers';
import { Lamp } from '../../components/ui/lamp';

interface LookupRow {
  id: string;
  email: string;
  plan: string | null;
  subscription_status: string;
  created_at: string;
  worker_count: number;
  last_seen_at: string | null;
  heartbeat_at: string | null;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getCurrentAccount();

  // Authorization is enforced HERE, on the server, not by hiding the nav link.
  // The bar omits the link for non-admins as a convenience; this is the check
  // that matters. notFound() rather than a 403 page: an admin surface should
  // not confirm its own existence to someone who cannot use it.
  if (account.role !== 'admin') notFound();

  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim() : '';

  const results = query
    ? ((await sql`
        select
          a.id,
          a.email,
          a.plan,
          a.subscription_status,
          a.created_at,
          count(w.id)::int          as worker_count,
          max(w.last_seen_at)       as last_seen_at,
          max(w.heartbeat_at)       as heartbeat_at
        from accounts a
        left join workers w on w.account_id = a.id
        where a.email ilike ${'%' + query + '%'}
        group by a.id
        order by a.created_at desc
        limit 25
      `) as LookupRow[])
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Account lookup"
        deck="Find an account by email to see its subscription and whether a machine has ever reported in."
      />

      <form method="get" className="flex flex-wrap items-center gap-3">
        <label htmlFor="q" className="sr-only">
          Email
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="someone@example.com"
          className="h-9 w-full max-w-[360px] rounded border border-rule-mark bg-surface-elevated px-3 text-[13px] text-text-primary placeholder:text-text-quaternary"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-full border border-rule-mark px-4 font-brand text-[13px] font-semibold text-text-primary transition-colors duration-150 ease-base hover:border-accent hover:text-accent"
        >
          Look up
        </button>
      </form>

      <div className="mt-stack-3">
        <Notice title="Read only">
          This view can see account state and nothing else. It cannot change a plan, read a key, or
          see anything Ocular has captured — no such record exists.
        </Notice>
      </div>

      <div className="mt-stack-4">
        {!query ? (
          <EmptyState
            title="Search for an account"
            description="Enter a full or partial email address."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No match"
            description={`Nothing found for "${query}". They may have signed up with a different address.`}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Signed up</Th>
                <Th numeric>Machines</Th>
                <Th>Last report</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <Tr key={row.id}>
                  <Td mono>{row.email}</Td>
                  <Td mono>{row.plan ?? <Blank />}</Td>
                  <Td>
                    <Lamp
                      state={
                        row.subscription_status === 'active'
                          ? 'live'
                          : row.subscription_status === 'past_due'
                            ? 'caution'
                            : row.subscription_status === 'canceled'
                              ? 'fault'
                              : 'inactive'
                      }
                      label={row.subscription_status}
                    />
                  </Td>
                  <Td mono>{formatDay(row.created_at)}</Td>
                  <Td numeric>{row.worker_count}</Td>
                  <Td mono>
                    {row.last_seen_at ? (
                      <>
                        {formatRelative(row.heartbeat_at ?? row.last_seen_at)}
                        <span className="ml-2 text-text-quaternary">
                          {workerState({
                            lastSeenAt: row.last_seen_at,
                            heartbeatAt: row.heartbeat_at,
                          })}
                        </span>
                      </>
                    ) : (
                      <Blank />
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
