// ---------------------------------------------------------------------------
// Date utility functions
// ---------------------------------------------------------------------------

/**
 * Convert a YYYYMMDD date key string to a Date object (UTC).
 */
export function dateKeyToDate(dateKey: string): Date {
  const year = parseInt(dateKey.substring(0, 4), 10);
  const month = parseInt(dateKey.substring(4, 6), 10) - 1;
  const day = parseInt(dateKey.substring(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Convert a Date object to a YYYYMMDD date key string (UTC).
 */
export function dateToDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Get today's date as YYYYMMDD string for use in Redis key naming.
 */
export function getTodayDateKey(): string {
  return dateToDateKey(new Date());
}

/**
 * Get a date key for a date relative to the given date key.
 * Example: getRelativeDateKey('20260524', -1) returns '20260523'
 */
export function getRelativeDateKey(dateKey: string, offsetDays: number): string {
  const date = dateKeyToDate(dateKey);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return dateToDateKey(date);
}

/**
 * Format a YYYYMMDD date key into a human-readable date (e.g. "May 24, 2026").
 */
export function formatDate(dateKey: string): string {
  const date = dateKeyToDate(dateKey);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
