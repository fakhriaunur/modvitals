// ---------------------------------------------------------------------------
// 5-field cron matcher (pure function, no external deps)
//
// Fields: minute (0-59), hour (0-23), dayOfMonth (1-31), month (1-12),
//         dayOfWeek (0-6, 0=Sunday)
//
// Supports:
//   *    - any value (wildcard)
//   N    - exact match
//   N,M  - comma-separated list (any-of)
//   */N  - step value (matches every Nth value within range)
// ---------------------------------------------------------------------------

/**
 * Parse a single cron field value and return a set of matching numbers
 * within the given range [min, max].
 *
 * Returns null if the field matches everything (wildcard or star-slash-1).
 * Returns empty set if no match is possible (invalid expression).
 */
function parseCronField(field: string, min: number, max: number) {
  field = field.trim();

  // Wildcard
  if (field === '*') return null;

  // Step value: */N
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10);
    if (isNaN(step) || step < 1) return new Set();
    if (step === 1) return null;
    const values = new Set();
    for (let v = min; v <= max; v += step) {
      values.add(v);
    }
    return values;
  }

  // Comma-separated list (or single value)
  const parts = field.split(',').map((s: string) => s.trim());
  const values = new Set();
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < min || n > max) return new Set();
    values.add(n);
  }
  return values;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Check whether a 5-field cron expression matches the given date/time.
 *
 * @param cron  - 5-field cron expression (e.g. "0 12 * * *")
 * @param date  - The Date to check against (uses UTC components)
 * @returns true if the cron expression matches
 */
export function matchCron(cron: string, date: Date): boolean {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const minuteField = fields[0];
  const hourField = fields[1];
  const domField = fields[2];
  const monthField = fields[3];
  const dowField = fields[4];

  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dayOfWeek = date.getUTCDay();

  const minuteSet = parseCronField(minuteField, 0, 59);
  const hourSet = parseCronField(hourField, 0, 23);
  const domSet = parseCronField(domField, 1, 31);
  const monthSet = parseCronField(monthField, 1, 12);
  const dowSet = parseCronField(dowField, 0, 6);

  if (minuteSet !== null && !minuteSet.has(minute)) return false;
  if (hourSet !== null && !hourSet.has(hour)) return false;
  if (domSet !== null && !domSet.has(dayOfMonth)) return false;
  if (monthSet !== null && !monthSet.has(month)) return false;
  if (dowSet !== null && !dowSet.has(dayOfWeek)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a 5-field cron expression string.
 *
 * @returns null if valid, or an error message string if invalid.
 */
export function validateCron(cron: string) {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return 'Cron expression must have exactly 5 space-separated fields: minute hour day-of-month month day-of-week';
  }

  const fieldNames = [
    'minute (0-59)',
    'hour (0-23)',
    'day-of-month (1-31)',
    'month (1-12)',
    'day-of-week (0-6)',
  ];
  const ranges = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];

  for (let i = 0; i < 5; i++) {
    const raw = fields[i].trim();
    const min = ranges[i][0];
    const max = ranges[i][1];

    // Wildcard is always valid
    if (raw === '*') continue;

    // Step value
    if (raw.startsWith('*/')) {
      const step = parseInt(raw.substring(2), 10);
      if (isNaN(step) || step < 1) {
        return (
          'Invalid step value in ' +
          fieldNames[i] +
          ' field: "' +
          raw +
          '" -- step must be a positive integer'
        );
      }
      continue;
    }

    // Comma-separated list
    const parts = raw.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      const n = parseInt(trimmed, 10);
      if (isNaN(n) || n < min || n > max) {
        return (
          'Invalid value "' +
          trimmed +
          '" in ' +
          fieldNames[i] +
          ' field. Expected a number between ' +
          min +
          ' and ' +
          max +
          '.'
        );
      }
    }
  }

  return null;
}
