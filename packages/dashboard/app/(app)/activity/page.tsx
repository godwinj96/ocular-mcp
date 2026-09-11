// Activity — the account audit trail.
//
// WHAT IS AND ISN'T HERE, because the boundary is the design rather than a
// limitation. This lists things done TO the account: a key created or revoked,
// a plan changed, a machine connecting. It does NOT list what Ocular looked at,
// and it never will: local captures include localhost and (phase 2)
// authenticated pages, so a capture log would be a record of a developer's
// private surfaces sitting in a database we operate rather than on their
// machine. CLAUDE.md's threat model exists to prevent exactly that artefact.
//
// The absence is stated on the page rather than left to be noticed. It is a
// feature and reads as one.
import { getCurrentAccount } from '../../../lib/current-account';
import { listAuditEvents, describeAuditEvent } from '../../../lib/audit';
import { PageHeader } from '../../../components/ui/page-header';
import { EmptyState } from '../../../components/ui/empty-state';
import { Table, Th, Td, Tr } from '../../../components/ui/table';
import { formatTimestamp } from '../../../lib/format';

const ACTOR_LABEL: Record<string, string> = {
  user: 'you',
  worker: 'a machine',
  system: 'billing',
};

export default async function ActivityPage() {
  const account = await getCurrentAccount();
  const events = await listAuditEvents(account.id);

  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Account activity"
        deck="Changes to your account — keys, plan, and machines connecting."
      />

      {events.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Signing in, creating a key, changing your plan, or connecting a machine will show up here."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>What</Th>
              <Th>By</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <Tr key={event.id}>
                <Td mono className="whitespace-nowrap">
                  {formatTimestamp(event.createdAt)}
                </Td>
                <Td>{describeAuditEvent(event)}</Td>
                <Td mono>{ACTOR_LABEL[event.actor] ?? event.actor}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <p className="mt-stack-4 max-w-[64ch] text-[15px] text-text-tertiary">
        Ocular doesn&apos;t keep a record of what it looked at. Pages on your own machine never
        leave it, and nothing here logs a URL.
      </p>
    </>
  );
}
