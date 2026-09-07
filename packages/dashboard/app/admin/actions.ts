'use server';

// Every admin mutation. Each function re-checks role === 'admin' itself —
// see DEVLOG's Session 35 admin entry ("every new admin route and every new
// mutation must repeat that check independently — hiding a nav link is not
// authorization") — rather than trusting the layout/page check alone, the
// same defense-in-depth posture app/access/actions.ts already takes for
// account-scoped mutations. A Server Action is directly callable; the page
// that renders its trigger is not the only thing standing between this code
// and a request.
import { revalidatePath } from 'next/cache';
import { getCurrentAccount } from '../../lib/current-account';
import {
  banAccount,
  unbanAccount,
  changeAccountPlanByAdmin,
  changeAccountRole,
} from '../../lib/accounts';
import type { AccountRole } from '../../lib/accounts';
import { recordAuditEvent } from '../../lib/audit';
import { getFlag, setFlag, WAITLIST_MODE_KEY } from '../../lib/feature-flags';
import { markInvited } from '../../lib/waitlist';

class NotAdminError extends Error {
  constructor() {
    super('Caller is not an admin');
  }
}

async function requireAdmin(): Promise<{ id: string }> {
  const account = await getCurrentAccount();
  if (account.role !== 'admin') throw new NotAdminError();
  return account;
}

export async function banAccountAction(
  targetAccountId: string,
  reason: string | null,
): Promise<void> {
  const admin = await requireAdmin();
  await banAccount(targetAccountId);
  await recordAuditEvent(
    targetAccountId,
    'account.banned',
    { reason, byAdmin: admin.id },
    'system',
  );
  revalidatePath('/admin/users');
}

export async function unbanAccountAction(targetAccountId: string): Promise<void> {
  const admin = await requireAdmin();
  await unbanAccount(targetAccountId);
  await recordAuditEvent(targetAccountId, 'account.unbanned', { byAdmin: admin.id }, 'system');
  revalidatePath('/admin/users');
}

export async function changePlanAction(targetAccountId: string, plan: string): Promise<void> {
  const admin = await requireAdmin();
  await changeAccountPlanByAdmin(targetAccountId, plan);
  await recordAuditEvent(
    targetAccountId,
    'plan.changed_by_admin',
    { plan, byAdmin: admin.id },
    'system',
  );
  revalidatePath('/admin/users');
}

export async function changeRoleAction(targetAccountId: string, role: AccountRole): Promise<void> {
  await requireAdmin();
  await changeAccountRole(targetAccountId, role);
  await recordAuditEvent(targetAccountId, 'role.changed', { role }, 'system');
  revalidatePath('/admin/users');
}

export async function toggleWaitlistModeAction(): Promise<boolean> {
  await requireAdmin();
  const current = await getFlag(WAITLIST_MODE_KEY);
  await setFlag(WAITLIST_MODE_KEY, !current);
  revalidatePath('/admin/waitlist');
  return !current;
}

export async function markWaitlistInvitedAction(ids: string[]): Promise<void> {
  await requireAdmin();
  await markInvited(ids);
  revalidatePath('/admin/waitlist');
}
