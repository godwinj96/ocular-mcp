'use client';

import { useRef, useState, useTransition } from 'react';
import { Panel } from '../ui/panel';
import { KeyValues } from '../ui/readouts';
import { Lamp } from '../ui/lamp';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';
import { formatDay } from '../../lib/format';
import {
  banAccountAction,
  unbanAccountAction,
  changePlanAction,
  changeRoleAction,
} from '../../app/(app)/admin/actions';
import type { AdminAccountRow } from '../../lib/accounts';

// List -> detail, not inline row actions (see DEVLOG's Session 35 admin
// entry for the reasoning this design spec settled on): three mutations at
// three different severities crammed into one table row puts Ban within a
// thumb-width of Promote, exactly the mis-click risk a support tool that
// already fears "mutating the wrong stranger's billing" shouldn't accept.
//
// planOptions is a PROP, not `import { PLAN_SLUGS } from '@ocular/shared'`
// here, on purpose: this file is 'use client', and @ocular/shared's barrel
// (docs/rules/02-repo-structure.md §4 — the ONLY import path allowed) also
// re-exports cache-key.ts, which uses node:crypto. Importing the barrel from
// a client component drags that into the browser bundle and the build fails
// outright. The server component that renders this (app/admin/users/page.tsx)
// imports PLAN_SLUGS normally — no such restriction there — and passes it
// down as plain data.
export function UserDetailPanel({
  account,
  planOptions,
}: {
  account: AdminAccountRow;
  planOptions: readonly string[];
}) {
  return (
    <Panel title={account.email} meta={`Signed up ${formatDay(account.createdAt)}`}>
      <KeyValues
        rows={[
          { key: 'Plan', value: account.plan ?? '—' },
          {
            key: 'Status',
            value: (
              <Lamp
                state={
                  account.subscriptionStatus === 'active'
                    ? 'live'
                    : account.subscriptionStatus === 'past_due'
                      ? 'caution'
                      : account.subscriptionStatus === 'canceled'
                        ? 'fault'
                        : 'inactive'
                }
                label={account.subscriptionStatus}
              />
            ),
          },
          { key: 'Role', value: account.role },
          { key: 'Machines', value: account.workerCount },
          {
            key: 'Banned',
            value: account.bannedAt ? `since ${formatDay(account.bannedAt)}` : 'no',
          },
        ]}
      />

      <div className="mt-stack-4 flex flex-col gap-4">
        <TierChange accountId={account.id} currentPlan={account.plan} planOptions={planOptions} />
        <RoleChange accountId={account.id} currentRole={account.role} />
        <BanControl accountId={account.id} bannedAt={account.bannedAt} />
      </div>
    </Panel>
  );
}

function TierChange({
  accountId,
  currentPlan,
  planOptions,
}: {
  accountId: string;
  currentPlan: string | null;
  planOptions: readonly string[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-text-secondary">Change tier</span>
      <select
        defaultValue={currentPlan ?? ''}
        disabled={pending}
        onChange={(e) => {
          const plan = e.target.value;
          if (!plan) return;
          startTransition(() => changePlanAction(accountId, plan));
        }}
        className="h-9 rounded border border-rule-mark bg-surface-elevated px-3 font-mono text-[13px] text-text-primary"
      >
        <option value="" disabled>
          Select a plan
        </option>
        {planOptions.map((slug) => (
          <option key={slug} value={slug}>
            {slug}
          </option>
        ))}
      </select>
    </div>
  );
}

function RoleChange({
  accountId,
  currentRole,
}: {
  accountId: string;
  currentRole: 'user' | 'admin';
}) {
  const [pending, startTransition] = useTransition();
  const next = currentRole === 'admin' ? 'user' : 'admin';

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-text-secondary">Role: {currentRole}</span>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => changeRoleAction(accountId, next))}
      >
        {currentRole === 'admin' ? 'Demote to user' : 'Promote to admin'}
      </Button>
    </div>
  );
}

// Two-step inline disclosure, no modal -- button.tsx's own doctrine already
// rules out a filled destructive button ("Revoke should never be the
// loudest thing on a screen"), and this system rejects modal chrome
// everywhere else it could have used one. Focus moves to Cancel on
// entering the confirm state, same safety logic a modal would apply, so a
// stray Enter can't ban someone.
function BanControl({ accountId, bannedAt }: { accountId: string; bannedAt: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  if (bannedAt) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-text-secondary">This account is banned</span>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(() => unbanAccountAction(accountId))}
        >
          Unban
        </Button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-text-secondary">Ban this account</span>
        <Button
          variant="destructive"
          onClick={() => {
            setConfirming(true);
            requestAnimationFrame(() => cancelRef.current?.focus());
          }}
        >
          Ban account
        </Button>
      </div>
    );
  }

  return (
    <Notice
      tone="fault"
      title="Ban this account"
      action={
        <div className="flex items-center gap-4">
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await banAccountAction(accountId, null);
                setConfirming(false);
              })
            }
          >
            Confirm ban
          </Button>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => setConfirming(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setConfirming(false);
            }}
            className="font-mono text-[12px] text-text-secondary underline decoration-rule-mark underline-offset-4 hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      }
    >
      They will be signed out and cannot sign back in — both their session and any API keys stop
      working. This does not cancel their subscription; do that separately if it's warranted.
    </Notice>
  );
}
