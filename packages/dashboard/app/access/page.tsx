// Access. Renamed from /keys, and demoted in the nav.
//
// The setup page promises "No key in it, so there's nothing to rotate and
// nothing to leak", and OCULAR_API_KEY is scheduled for removal entirely. A nav
// item titled "API Keys" sitting at a third of the authenticated root
// contradicts that promise on the surface a user reaches immediately after
// reading it. Keys are the CI escape hatch; the IA should say so by rank.
import { getCurrentAccount } from '../../lib/current-account';
import { listApiKeys } from '../../lib/keys';
import { revokeKeyAction } from './actions';
import { GenerateKeyForm } from './generate-key-form';
import { PageHeader } from '../../components/ui/page-header';
import { Notice } from '../../components/ui/notice';
import { EmptyState } from '../../components/ui/empty-state';
import { Table, Th, Td, Tr, Blank } from '../../components/ui/table';
import { Lamp } from '../../components/ui/lamp';
import { formatDay, formatRelative } from '../../lib/format';

export default async function AccessPage() {
  const account = await getCurrentAccount();
  const keys = await listApiKeys(account.id);

  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="API keys"
        deck="You don't need a key for normal use — signing in once on this machine is enough."
      />

      <Notice title="When a key is worth making">
        Create one only for an agent that runs without you: CI, a scheduled job, a server. Anything
        that can open a browser should sign in instead.
      </Notice>

      <div className="mt-stack-3">
        <GenerateKeyForm />
      </div>

      <div className="mt-stack-4">
        {keys.length === 0 ? (
          // Reassurance, not an implied unfinished task. Most people never need
          // one, and the empty state should say that rather than sit there
          // looking like a step they skipped.
          <EmptyState
            title="No keys — and most people never need one"
            description="If an agent has to reach Ocular without a browser sign-in, generate one here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Key</Th>
                <Th>Label</Th>
                <Th>Created</Th>
                <Th>Last used</Th>
                <Th>Status</Th>
                <Th numeric>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const revoked = Boolean(key.revokedAt);
                return (
                  <Tr key={key.id} muted={revoked}>
                    <Td mono>{key.keyPrefix}…</Td>
                    <Td>{key.label ?? <Blank />}</Td>
                    <Td mono>{formatDay(key.createdAt)}</Td>
                    {/* Already fetched by lib/keys.ts and thrown away until now.
                        Resend's pattern: a key you can see is dead is a key you
                        can revoke without hesitating. */}
                    <Td mono>{key.lastUsedAt ? formatRelative(key.lastUsedAt) : <Blank />}</Td>
                    <Td>
                      <Lamp
                        state={revoked ? 'inactive' : 'live'}
                        label={revoked ? 'revoked' : 'active'}
                      />
                    </Td>
                    <Td numeric>
                      {!revoked && (
                        <form action={revokeKeyAction.bind(null, key.id)}>
                          {/* Quiet level in --fault, never a filled red button:
                              Revoke should never be the loudest thing here. */}
                          <button
                            type="submit"
                            className="font-mono text-[12px] text-fault underline decoration-rule-mark underline-offset-4 transition-colors duration-fast ease-base hover:decoration-fault"
                          >
                            Revoke
                          </button>
                        </form>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
