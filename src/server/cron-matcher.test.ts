/**
 * Tests for the 5-field cron matcher (cron-matcher.ts).
 *
 * Covers matchCron with wildcards, exact values, comma-separated lists,
 * step values, edge cases, and validateCron.
 */

import { matchCron, validateCron } from './cron-matcher.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertStrictEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected ${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// matchCron — basic patterns
// ---------------------------------------------------------------------------
console.log('\n--- matchCron: basic ---');

// Every minute (* * * * *) matches any time
assert(matchCron('* * * * *', new Date(Date.UTC(2026, 4, 26, 10, 30, 0))), '* * * * * matches any time');
assert(matchCron('* * * * *', new Date(Date.UTC(2026, 4, 26, 23, 59, 0))), '* * * * * matches last minute of day');

// Exact minute+hour
const cronExact = '30 10 * * *';
assert(matchCron(cronExact, new Date(Date.UTC(2026, 4, 26, 10, 30, 0))), '30 10 * * * matches 10:30');
assert(!matchCron(cronExact, new Date(Date.UTC(2026, 4, 26, 10, 31, 0))), '30 10 * * * does not match 10:31');
assert(!matchCron(cronExact, new Date(Date.UTC(2026, 4, 26, 11, 30, 0))), '30 10 * * * does not match 11:30');

// Wildcard minute, exact hour
assert(matchCron('* 12 * * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '* 12 * * * matches 12:00');
assert(matchCron('* 12 * * *', new Date(Date.UTC(2026, 4, 26, 12, 59, 0))), '* 12 * * * matches 12:59');
assert(!matchCron('* 12 * * *', new Date(Date.UTC(2026, 4, 26, 13, 0, 0))), '* 12 * * * does not match 13:00');

// Exact minute, wildcard hour
assert(matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '0 * * * * matches 00:00');
assert(matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 * * * * matches 12:00');
assert(!matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 12, 1, 0))), '0 * * * * does not match 12:01');

// ---------------------------------------------------------------------------
// matchCron — comma-separated lists
// ---------------------------------------------------------------------------
console.log('\n--- matchCron: comma lists ---');

// Multiple minutes
const multiMin = '0,15,30,45 * * * *';
assert(matchCron(multiMin, new Date(Date.UTC(2026, 4, 26, 8, 0, 0))), '0,15,30,45 matches :00');
assert(matchCron(multiMin, new Date(Date.UTC(2026, 4, 26, 8, 15, 0))), '0,15,30,45 matches :15');
assert(matchCron(multiMin, new Date(Date.UTC(2026, 4, 26, 8, 30, 0))), '0,15,30,45 matches :30');
assert(matchCron(multiMin, new Date(Date.UTC(2026, 4, 26, 8, 45, 0))), '0,15,30,45 matches :45');
assert(!matchCron(multiMin, new Date(Date.UTC(2026, 4, 26, 8, 7, 0))), '0,15,30,45 does not match :07');

// Multiple hours
const multiHour = '0 0,12 * * *';
assert(matchCron(multiHour, new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '0 0,12 * * * matches 00:00');
assert(matchCron(multiHour, new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 0,12 * * * matches 12:00');
assert(!matchCron(multiHour, new Date(Date.UTC(2026, 4, 26, 6, 0, 0))), '0 0,12 * * * does not match 06:00');

// Multiple days of week
assert(matchCron('0 12 * * 1,3,5', new Date(Date.UTC(2026, 4, 25, 12, 0, 0))), '0 12 * * 1,3,5 matches Mon 2026-05-25 (day 1)');
assert(!matchCron('0 12 * * 1,3,5', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 12 * * 1,3,5 does not match Tue 2026-05-26 (day 2)');

// ---------------------------------------------------------------------------
// matchCron — step values
// ---------------------------------------------------------------------------
console.log('\n--- matchCron: step values ---');

// Every 4 hours (*/4)
const every4h = '0 */4 * * *';
assert(matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '0 */4 * * * matches hour 0');
assert(matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 4, 0, 0))), '0 */4 * * * matches hour 4');
assert(matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 8, 0, 0))), '0 */4 * * * matches hour 8');
assert(matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 */4 * * * matches hour 12');
assert(matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 16, 0, 0))), '0 */4 * * * matches hour 16');
assert(matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 20, 0, 0))), '0 */4 * * * matches hour 20');
assert(!matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 2, 0, 0))), '0 */4 * * * does not match hour 2');
assert(!matchCron(every4h, new Date(Date.UTC(2026, 4, 26, 1, 0, 0))), '0 */4 * * * does not match hour 1');

// Every 12 hours (*/12)
const every12h = '0 */12 * * *';
assert(matchCron(every12h, new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '0 */12 * * * matches hour 0');
assert(matchCron(every12h, new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 */12 * * * matches hour 12');
assert(!matchCron(every12h, new Date(Date.UTC(2026, 4, 26, 6, 0, 0))), '0 */12 * * * does not match hour 6');

// */1 is equivalent to *
assert(matchCron('*/1 * * * *', new Date(Date.UTC(2026, 4, 26, 10, 30, 0))), '*/1 * * * * matches any minute (step 1)');

// Step on minutes
assert(matchCron('*/15 * * * *', new Date(Date.UTC(2026, 4, 26, 10, 0, 0))), '*/15 * * * * matches :00');
assert(matchCron('*/15 * * * *', new Date(Date.UTC(2026, 4, 26, 10, 15, 0))), '*/15 * * * * matches :15');
assert(matchCron('*/15 * * * *', new Date(Date.UTC(2026, 4, 26, 10, 30, 0))), '*/15 * * * * matches :30');
assert(matchCron('*/15 * * * *', new Date(Date.UTC(2026, 4, 26, 10, 45, 0))), '*/15 * * * * matches :45');
assert(!matchCron('*/15 * * * *', new Date(Date.UTC(2026, 4, 26, 10, 7, 0))), '*/15 * * * * does not match :07');

// ---------------------------------------------------------------------------
// matchCron — day-of-month and month matching
// ---------------------------------------------------------------------------
console.log('\n--- matchCron: date/month matching ---');

// Specific day of month
assert(matchCron('0 12 15 * *', new Date(Date.UTC(2026, 4, 15, 12, 0, 0))), '0 12 15 * * matches 15th');
assert(!matchCron('0 12 15 * *', new Date(Date.UTC(2026, 4, 16, 12, 0, 0))), '0 12 15 * * does not match 16th');

// Specific month
assert(matchCron('0 12 * 5 *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 12 * 5 * matches May (month 5)');
assert(!matchCron('0 12 * 5 *', new Date(Date.UTC(2026, 5, 26, 12, 0, 0))), '0 12 * 5 * does not match June (month 6)');

// Specific day of week (Monday = 1)
assert(matchCron('0 12 * * 1', new Date(Date.UTC(2026, 4, 25, 12, 0, 0))), '0 12 * * 1 matches Monday 2026-05-25');
assert(!matchCron('0 12 * * 1', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '0 12 * * 1 does not match Tuesday 2026-05-26');

// Sunday = 0
assert(matchCron('0 12 * * 0', new Date(Date.UTC(2026, 4, 24, 12, 0, 0))), '0 12 * * 0 matches Sunday 2026-05-24');
assert(!matchCron('0 12 * * 0', new Date(Date.UTC(2026, 4, 25, 12, 0, 0))), '0 12 * * 0 does not match Monday');

// ---------------------------------------------------------------------------
// matchCron — preset equivalent patterns
// ---------------------------------------------------------------------------
console.log('\n--- matchCron: preset patterns ---');

// Hourly at minute 0: 0 * * * *
assert(matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), 'hourly: 0 * * * * matches 00:00');
assert(matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 1, 0, 0))), 'hourly: 0 * * * * matches 01:00');
assert(matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 23, 0, 0))), 'hourly: 0 * * * * matches 23:00');
assert(!matchCron('0 * * * *', new Date(Date.UTC(2026, 4, 26, 1, 1, 0))), 'hourly: 0 * * * * does not match 01:01');

// 4-hourly at minute 0: 0 */4 * * *
assert(matchCron('0 */4 * * *', new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '4-hourly: 0 */4 * * * matches 00:00');
assert(matchCron('0 */4 * * *', new Date(Date.UTC(2026, 4, 26, 4, 0, 0))), '4-hourly: 0 */4 * * * matches 04:00');
assert(matchCron('0 */4 * * *', new Date(Date.UTC(2026, 4, 26, 8, 0, 0))), '4-hourly: 0 */4 * * * matches 08:00');
assert(matchCron('0 */4 * * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '4-hourly: 0 */4 * * * matches 12:00');
assert(matchCron('0 */4 * * *', new Date(Date.UTC(2026, 4, 26, 16, 0, 0))), '4-hourly: 0 */4 * * * matches 16:00');
assert(matchCron('0 */4 * * *', new Date(Date.UTC(2026, 4, 26, 20, 0, 0))), '4-hourly: 0 */4 * * * matches 20:00');

// 12-hourly at minute 0: 0 */12 * * *
assert(matchCron('0 */12 * * *', new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '12-hourly: 0 */12 * * * matches 00:00');
assert(matchCron('0 */12 * * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), '12-hourly: 0 */12 * * * matches 12:00');

// Daily at hour 12: 0 12 * * *
assert(matchCron('0 12 * * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), 'daily: 0 12 * * * matches 12:00');
assert(!matchCron('0 12 * * *', new Date(Date.UTC(2026, 4, 26, 11, 0, 0))), 'daily: 0 12 * * * does not match 11:00');

// Weekly on Monday at hour 12: 0 12 * * 1
assert(matchCron('0 12 * * 1', new Date(Date.UTC(2026, 4, 25, 12, 0, 0))), 'weekly: 0 12 * * 1 matches Monday 12:00');
assert(!matchCron('0 12 * * 1', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), 'weekly: 0 12 * * 1 does not match Tuesday');

// ---------------------------------------------------------------------------
// matchCron — edge cases
// ---------------------------------------------------------------------------
console.log('\n--- matchCron: edge cases ---');

// Invalid cron expression (fewer than 5 fields)
assert(!matchCron('0 12 * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), 'invalid cron (4 fields) returns false');

// Empty string
assert(!matchCron('', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), 'empty cron returns false');

// Whitespace padding
assert(matchCron('  0  12  *  *  *  ', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), 'whitespace padding still matches');

// Out of range values return false for matchCron (parseCronField returns empty set)
assert(!matchCron('60 * * * *', new Date(Date.UTC(2026, 4, 26, 12, 0, 0))), 'minute 60 out of range returns false');

// Cross-day boundary at midnight
assert(matchCron('0 0 * * *', new Date(Date.UTC(2026, 4, 26, 0, 0, 0))), '0 0 * * * matches midnight');
assert(!matchCron('0 0 * * *', new Date(Date.UTC(2026, 4, 26, 0, 1, 0))), '0 0 * * * does not match 00:01');

// Last minute of day (23:59)
assert(matchCron('59 23 * * *', new Date(Date.UTC(2026, 4, 26, 23, 59, 0))), '59 23 * * * matches 23:59');
assert(!matchCron('59 23 * * *', new Date(Date.UTC(2026, 4, 27, 0, 0, 0))), '59 23 * * * does not match next day');

// ---------------------------------------------------------------------------
// validateCron
// ---------------------------------------------------------------------------
console.log('\n--- validateCron ---');

// Valid expressions
assertStrictEqual(validateCron('* * * * *'), null, 'valid: * * * * *');
assertStrictEqual(validateCron('0 12 * * *'), null, 'valid: 0 12 * * *');
assertStrictEqual(validateCron('0,15,30,45 */4 * * *'), null, 'valid: comma minutes + step hours');
assertStrictEqual(validateCron('*/5 */2 * * *'), null, 'valid: step on both minute and hour');
assertStrictEqual(validateCron('0 12 * * 1'), null, 'valid: 0 12 * * 1');
assertStrictEqual(validateCron('30 6,18 15 * 0,6'), null, 'valid: complex expression');
assertStrictEqual(validateCron('  0  12  *  *  *  '), null, 'valid: extra whitespace');

// Invalid: wrong number of fields
assert(validateCron('0 12 * *') !== null, 'invalid: 4 fields');
assert(validateCron('0 12 * * * *') !== null, 'invalid: 6 fields');
assert(validateCron('') !== null, 'invalid: empty');

// Invalid: out of range
assert(validateCron('60 * * * *') !== null, 'invalid: minute 60');
assert(validateCron('* 24 * * *') !== null, 'invalid: hour 24');
assert(validateCron('* * 32 * *') !== null, 'invalid: day 32');
assert(validateCron('* * * 13 *') !== null, 'invalid: month 13');
assert(validateCron('* * * * 7') !== null, 'invalid: dayOfWeek 7');

// Invalid: non-numeric
assert(validateCron('abc * * * *') !== null, 'invalid: non-numeric minute');
assert(validateCron('* foo * * *') !== null, 'invalid: non-numeric hour');

// Invalid step
assert(validateCron('*/0 * * * *') !== null, 'invalid: step 0');
assert(validateCron('*/-1 * * * *') !== null, 'invalid: negative step');
assert(validateCron('*/abc * * * *') !== null, 'invalid: non-numeric step');

// Valid: boundaries
assertStrictEqual(validateCron('0 0 1 1 0'), null, 'valid: lower boundaries');
assertStrictEqual(validateCron('59 23 31 12 6'), null, 'valid: upper boundaries');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
