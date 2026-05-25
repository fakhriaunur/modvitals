// ---------------------------------------------------------------------------
// Date utility functions
// ---------------------------------------------------------------------------

/**
 * Format a YYYYMMDD date key into a human-readable date (e.g. "May 24, 2026").
 */
export function formatDate(dateKey: string): string {
  const year = parseInt(dateKey.substring(0, 4), 10);
  const month = parseInt(dateKey.substring(4, 6), 10) - 1;
  const day = parseInt(dateKey.substring(6, 8), 10);

  const date = new Date(Date.UTC(year, month, day));
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
