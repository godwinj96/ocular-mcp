'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAccount } from '../../lib/current-account';
import { createApiKey, revokeApiKey } from '../../lib/keys';

export async function generateKeyAction(label: string | null): Promise<{ rawKey: string }> {
  const account = await getCurrentAccount();
  const result = await createApiKey(account.id, label);
  revalidatePath('/keys');
  return result;
}

export async function revokeKeyAction(keyId: string): Promise<void> {
  const account = await getCurrentAccount();
  await revokeApiKey(account.id, keyId);
  revalidatePath('/keys');
}
