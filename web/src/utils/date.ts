/** BR-10: the product's "today" is the Bangkok calendar day, whatever the browser timezone. */
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

/** Today's calendar date in Bangkok as `YYYY-MM-DD`. */
export function bangkokToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** True when `date` (`YYYY-MM-DD`) is strictly after today in Bangkok. */
export function isFutureDate(date: string, now: Date = new Date()): boolean {
  return date > bangkokToday(now);
}

/** `2026-11-01` → `01 Nov 2026`; parsed as UTC so the calendar day never shifts. */
export function formatCalendarDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
