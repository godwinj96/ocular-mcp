// The waitlist toggle + list. See lib/waitlist.ts's header for why
// invited_at exists and app/api/public/waitlist* for the public-facing half
// of this feature the website's CTA calls.
import { getFlag, WAITLIST_MODE_KEY } from '../../../lib/feature-flags';
import { listWaitlist } from '../../../lib/waitlist';
import { PageHeader } from '../../../components/ui/page-header';
import { Table, Th, Td, Tr, Blank } from '../../../components/ui/table';
import { EmptyState } from '../../../components/ui/empty-state';
import { ButtonLink } from '../../../components/ui/button';
import { formatDay } from '../../../lib/format';
import { WaitlistToggle } from '../../../components/admin/waitlist-toggle';

export default async function AdminWaitlistPage() {
  const [enabled, entries] = await Promise.all([getFlag(WAITLIST_MODE_KEY), listWaitlist()]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Waitlist"
        deck="When on, the site shows a signup form instead of checkout."
      />

      <WaitlistToggle initialEnabled={enabled} />

      <div className="rule-hairline mt-stack-4 border-b border-rule-structural" />

      <div className="mt-stack-4 flex items-center justify-between">
        <p className="font-mono text-[11px] text-text-tertiary">{entries.length} waiting</p>
        <ButtonLink href="/admin/waitlist/export.csv" variant="secondary">
          Export CSV
        </ButtonLink>
      </div>

      <div className="mt-stack-3">
        {entries.length === 0 ? (
          <EmptyState title="Nobody's waiting" description="No one has joined the waitlist yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Joined</Th>
                <Th>Invited</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td mono>{entry.email}</Td>
                  <Td mono>{formatDay(entry.createdAt)}</Td>
                  <Td mono>{entry.invitedAt ? formatDay(entry.invitedAt) : <Blank />}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
