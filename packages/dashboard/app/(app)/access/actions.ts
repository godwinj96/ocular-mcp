'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAccount } from '../../../lib/current-account';
import { createApiKey, revokeApiKey, listApiKeys } from '../../../lib/keys';
import { recordAuditEvent } from '../../../lib/audit';

// Both actions write an audit event. The detail is the key's PREFIX and label,
// never the raw key -- the raw key exists in memory for exactly one response
// and is never stored anywhere, which is the whole design of this table.
export async function generateKeyAction(label: string | null): Promise<{ rawKey: string }> {
  const account = await getCurrentAccount();
  const result = await createApiKey(account.id, label);
  await recordAuditEvent(account.id, 'key.created', label ? { label } : {});
  revalidatePath('/access');
  return result;
}

export async function revokeKeyAction(keyId: string): Promise<void> {
  const account = await getCurrentAccount();

  // Read the prefix before revoking so the audit line can name which key went
  // away. revokeApiKey is already scoped to the account, so this lookup is for
  // the label, not for authorization.
  const keys = await listApiKeys(account.id);
  const target = keys.find((k) => k.id === keyId);

  await revokeApiKey(account.id, keyId);
  await recordAuditEvent(account.id, 'key.revoked', {
    prefix: target?.keyPrefix ?? null,
    label: target?.label ?? null,
  });
  revalidatePath('/access');
}
