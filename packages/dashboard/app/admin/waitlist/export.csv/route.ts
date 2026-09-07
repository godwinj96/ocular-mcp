// CSV export. Route Handlers are NOT wrapped by app/admin/layout.tsx's auth
// gate -- layouts only cover page rendering, never route handlers in the
// same segment tree -- so this repeats the check itself, same as every
// other admin mutation/route in this feature.
import { notFound } from 'next/navigation';
import { getCurrentAccount } from '../../../../lib/current-account';
import { listWaitlist, waitlistToCsv } from '../../../../lib/waitlist';

export async function GET(): Promise<Response> {
  const account = await getCurrentAccount();
  if (account.role !== 'admin') notFound();

  const entries = await listWaitlist();
  const csv = waitlistToCsv(entries);

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="ocular-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
