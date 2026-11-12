/**
 * Calendar-date helpers (BR-10). The product's "today" is always a Bangkok calendar
 * day (system-sds §5: APP_TIMEZONE=Asia/Bangkok), never the server's local timezone.
 */

export const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Bangkok';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar date (`YYYY-MM-DD`) of `now` in `timeZone`. */
export function todayInTimeZone(
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * True when `date` (`YYYY-MM-DD`) is strictly after today in `timeZone`.
 * Both operands are zero-padded ISO dates, so a string comparison is chronological.
 */
export function isFutureDate(
  date: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date()
): boolean {
  return date > todayInTimeZone(timeZone, now);
}

/** True only for a real calendar day: `2026-02-30` and `2026-13-01` are rejected. */
export function isRealCalendarDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
