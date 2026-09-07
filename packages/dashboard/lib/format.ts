// Dates render ISO or as an explicit day-and-month, never via
// toLocaleDateString().
//
// The old key table used toLocaleDateString(), which formats against the
// running environment's locale -- so the server render and the browser render
// can disagree, which is a hydration mismatch waiting to happen. In a sortable
// column an unambiguous ISO date is also just better: 2026-09-07 sorts and
// scans; 07/09/2026 means two different days depending on who is reading.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** 2026-09-07 */
export function formatDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** 2026-09-07 14:20 UTC -- for deadlines, which must not decay while a page sits open. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

/** 7 October -- for a renewal date, where the year is noise. */
export function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// Relative time, but only ever DOWNWARD in precision and never as the sole
// statement of a deadline. "2 minutes ago" is the right register for a
// heartbeat; a grace-period cutoff gets an absolute timestamp, because a
// relative one silently rots on an open tab.
export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);

  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;

  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;

  return formatDay(iso);
}
