// Runtime toggles the website (a static Vite SPA with no server of its own)
// needs to read without a rebuild+redeploy. See
// infra/postgres/migrations/0003_admin_waitlist_flags.sql for why this is a
// generic key/value table rather than a dedicated boolean column: the next
// toggle an admin asks for shouldn't need its own migration.
import { sql } from './postgres';

export const WAITLIST_MODE_KEY = 'waitlist_mode';

// A missing row means off — same "absence is the default" pattern the quota
// reader uses for a missing Redis key, so a flag nobody has ever touched
// reads as its safe default rather than needing a seed row.
export async function getFlag(key: string): Promise<boolean> {
  const rows = (await sql`select value from feature_flags where key = ${key}`) as {
    value: unknown;
  }[];
  return rows[0]?.value === true;
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  await sql`
    insert into feature_flags (key, value, updated_at)
    values (${key}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
}
