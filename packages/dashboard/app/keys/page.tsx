import Link from 'next/link';
import { getCurrentAccount } from '../../lib/current-account';
import { listApiKeys } from '../../lib/keys';
import { revokeKeyAction } from './actions';
import { GenerateKeyForm } from './generate-key-form';

export default async function KeysPage() {
  const account = await getCurrentAccount();
  const keys = await listApiKeys(account.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-text-primary">API Keys</h1>
      <p className="mt-2 text-text-secondary">
        Use a static key for headless/CI agents. Prefer OAuth for interactive MCP clients.
      </p>

      <div className="mt-8">
        <GenerateKeyForm />
      </div>

      <ul className="mt-8 space-y-3">
        {keys.length === 0 && <p className="text-sm text-text-secondary">No keys yet.</p>}
        {keys.map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4"
          >
            <div>
              <p className="font-mono text-sm text-text-primary">
                {key.keyPrefix}…{key.label ? ` · ${key.label}` : ''}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {key.revokedAt
                  ? `Revoked ${new Date(key.revokedAt).toLocaleDateString()}`
                  : `Created ${new Date(key.createdAt).toLocaleDateString()}`}
              </p>
            </div>
            {!key.revokedAt && (
              <form action={revokeKeyAction.bind(null, key.id)}>
                <button type="submit" className="text-sm text-red-400 underline hover:text-red-300">
                  Revoke
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
