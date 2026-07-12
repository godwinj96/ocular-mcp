// Shared server helper for every protected page: confirms the AuthKit
// session, then ensures the corresponding accounts row exists (first-login
// provisioning — see accounts.ts). Centralized here so /keys, /quota, and
// /billing don't each re-implement the same two-step resolution.
import { withAuth } from '@workos-inc/authkit-nextjs';
import { ensureAccount } from './accounts';
import type { Account } from './accounts';

export async function getCurrentAccount(): Promise<Account> {
  const { user } = await withAuth({ ensureSignedIn: true });
  return ensureAccount(user.id, user.email);
}
