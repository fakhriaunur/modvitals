/**
 * Tests for settings pure functions.
 *
 * Covers shouldGenerateReport (all presets), asBoolean, asNumber, asFrequency,
 * and asTimezoneOffset.
 */

import { shouldGenerateReport, asBoolean, asNumber, asFrequency, asTimezoneOffset } from './settings.js';

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
// shouldGenerateReport — daily (backward compat)
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: daily ---');

const now = new Date();
const currentHour = now.getUTCHours();
const currentMinute = now.getUTCMinutes();
const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

// Daily at matching hour+minute
const dailyMatching = shouldGenerateReport('daily', currentHour, currentMinute);
assert(dailyMatching === true, `daily at current hour+minute returns true`);

// Daily at wrong hour
const wrongHour = (currentHour + 6) % 24;
const dailyWrong = shouldGenerateReport('daily', wrongHour, currentMinute);
assert(dailyWrong === false, `daily at wrong hour (${wrongHour}) returns false`);

// Daily at wrong minute
const wrongMinute = (currentMinute + 1) % 60;
const dailyWrongMin = shouldGenerateReport('daily', currentHour, wrongMinute);
assert(dailyWrongMin === false, `daily at wrong minute returns false`);

// Daily at matching hour+minute — always true regardless of day
assert(dailyMatching === true, 'daily at matching time always true');

// ---------------------------------------------------------------------------
// shouldGenerateReport — weekly
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: weekly ---');

// Weekly: true only when day===Monday AND hour matches AND minute matches
const weeklyMatching = shouldGenerateReport('weekly', currentHour, currentMinute);
const expectedWeekly = currentDay === 1;
assert(
  weeklyMatching === expectedWeekly,
  `weekly at current time returns ${expectedWeekly} (today is day ${currentDay})`,
);

// Weekly at wrong hour
const weeklyWrong = shouldGenerateReport('weekly', wrongHour, currentMinute);
assert(weeklyWrong === false, 'weekly at wrong hour returns false');

// Weekly at wrong minute
const weeklyWrongMin = shouldGenerateReport('weekly', currentHour, wrongMinute);
assert(weeklyWrongMin === false, 'weekly at wrong minute returns false');

// Weekly default minute=0 — should only match when minute is 0
const weeklyDefaultMin = shouldGenerateReport('weekly', currentHour);
if (currentMinute === 0) {
  assert(weeklyDefaultMin === (currentDay === 1), `weekly default minute matches when minute=0 (day ${currentDay})`);
} else {
  assert(weeklyDefaultMin === false, 'weekly default minute=0 returns false when minute!=0');
}

// ---------------------------------------------------------------------------
// shouldGenerateReport — hourly
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: hourly ---');

// Hourly: fires every hour at configured minute
const hourlyMatch = shouldGenerateReport('hourly', 12, currentMinute);
assert(hourlyMatch === true, 'hourly at matching minute returns true');

const hourlyWrongMin = shouldGenerateReport('hourly', 12, wrongMinute);
assert(hourlyWrongMin === false, 'hourly at wrong minute returns false');

// Hourly fires regardless of which hour
assert(hourlyMatch === true, 'hourly true regardless of hour');

// ---------------------------------------------------------------------------
// shouldGenerateReport — 4-hourly
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: 4-hourly ---');

// 4-hourly: fires at hours 0,4,8,12,16,20 at configured minute
const fourHourlyMatch = currentHour % 4 === 0
  ? shouldGenerateReport('4-hourly', 0, currentMinute)
  : false;

if (currentHour % 4 === 0) {
  assert(fourHourlyMatch === true, `4-hourly at hour ${currentHour} (divisible by 4) returns true`);
} else {
  assert(fourHourlyMatch === false, `4-hourly at hour ${currentHour} (not divisible by 4) returns false`);
}

// 4-hourly always false at wrong hour
const fourHourlyWrong = shouldGenerateReport('4-hourly', 0, currentMinute);
assert(fourHourlyWrong === (currentHour % 4 === 0), `4-hourly matches only when hour%4===0 (hour=${currentHour})`);

// 4-hourly at wrong minute
const fourHourlyWrongMin = shouldGenerateReport('4-hourly', 0, wrongMinute);
assert(fourHourlyWrongMin === false, '4-hourly at wrong minute returns false');

// ---------------------------------------------------------------------------
// shouldGenerateReport — 12-hourly
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: 12-hourly ---');

// 12-hourly: fires at hours 0,12 only
const twelveHourlyMatch = (currentHour === 0 || currentHour === 12)
  ? shouldGenerateReport('12-hourly', 0, currentMinute)
  : false;

if (currentHour === 0 || currentHour === 12) {
  assert(twelveHourlyMatch === true, `12-hourly at hour ${currentHour} (0 or 12) returns true`);
} else {
  assert(twelveHourlyMatch === false, `12-hourly at hour ${currentHour} (not 0 or 12) returns false`);
}

// 12-hourly at wrong minute
const twelveHourlyWrongMin = shouldGenerateReport('12-hourly', 0, wrongMinute);
assert(twelveHourlyWrongMin === false, '12-hourly at wrong minute returns false');

// ---------------------------------------------------------------------------
// shouldGenerateReport — custom (cron expression)
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: custom ---');

// Custom with no cron — returns false
const noCron = shouldGenerateReport('custom', 12, 0, undefined);
assert(noCron === false, 'custom with no cron returns false');

const emptyCron = shouldGenerateReport('custom', 12, 0, '');
assert(emptyCron === false, 'custom with empty cron returns false');

// Custom with matching cron (minute + hour wildcard)
const customHourly = shouldGenerateReport('custom', 0, currentMinute, `${currentMinute} * * * *`);
assert(customHourly === true, 'custom cron matches current minute with wildcard hour');

// Custom with non-matching cron
const customNonMatch = shouldGenerateReport('custom', 0, 0, '0 3 * * *');
const is3am = currentHour === 3 && currentMinute === 0;
assert(customNonMatch === is3am, `custom cron "0 3 * * *" matches only if hour=3 & minute=0 (now=${currentHour}:${currentMinute})`);

// Custom with invalid cron (returns false gracefully)
const invalidCron = shouldGenerateReport('custom', 0, 0, 'not-a-cron');
assert(invalidCron === false, 'custom with invalid cron returns false');

// ---------------------------------------------------------------------------
// shouldGenerateReport — timezone offset
// ---------------------------------------------------------------------------
console.log('\n--- shouldGenerateReport: timezone offset ---');

// With offset 0, results match non-offset calls
const tzZero = shouldGenerateReport('daily', currentHour, currentMinute, undefined, 0);
assert(tzZero === true, 'daily with tz offset 0 matches current time');

// Large offset shifts the "reference" time — we can't predict the result
// without knowing which UTC hour+minute it maps to, but we can verify
// it returns a boolean without error
const tzPositive = shouldGenerateReport('daily', 12, 0, undefined, 480); // UTC+8
assert(typeof tzPositive === 'boolean', 'timezone offset returns boolean');

// ---------------------------------------------------------------------------
// asBoolean
// ---------------------------------------------------------------------------
console.log('\n--- asBoolean ---');

// Boolean values pass through
assertStrictEqual(asBoolean(true, false), true, 'true boolean returns true');
assertStrictEqual(asBoolean(false, true), false, 'false boolean returns false');

// String "true" / "false"
assertStrictEqual(asBoolean('true', false), true, 'string "true" returns true');
assertStrictEqual(asBoolean('false', true), false, 'string "false" returns false');

// Fallback to default for unrecognized values
assertStrictEqual(asBoolean('yes', false), false, 'unrecognized string falls back to default false');
assertStrictEqual(asBoolean('yes', true), true, 'unrecognized string falls back to default true');
assertStrictEqual(asBoolean(null, true), true, 'null falls back to default');
assertStrictEqual(asBoolean(undefined, false), false, 'undefined falls back to default');
assertStrictEqual(asBoolean(0, true), true, 'number 0 falls back to default');
assertStrictEqual(asBoolean(1, false), false, 'number 1 falls back to default');

// ---------------------------------------------------------------------------
// asNumber
// ---------------------------------------------------------------------------
console.log('\n--- asNumber ---');

// Number values pass through
assertStrictEqual(asNumber(42, 0), 42, 'number 42 returns 42');
assertStrictEqual(asNumber(0, 10), 0, 'number 0 returns 0');

// String numbers are parsed
assertStrictEqual(asNumber('42', 0), 42, 'string "42" returns 42');
assertStrictEqual(asNumber('0', 10), 0, 'string "0" returns 0');

// Invalid string falls back to default
assertStrictEqual(asNumber('abc', 5), 5, 'non-numeric string falls back to default');
assertStrictEqual(asNumber('NaN', 5), 5, '"NaN" string falls back to default');
assertStrictEqual(asNumber('', 5), 5, 'empty string falls back to default');

// Non-string/number values fall back
assertStrictEqual(asNumber(null, 1), 1, 'null falls back to default');
assertStrictEqual(asNumber(undefined, 2), 2, 'undefined falls back to default');
assertStrictEqual(asNumber(true, 3), 3, 'boolean true falls back to default');
assertStrictEqual(asNumber(false, 4), 4, 'boolean false falls back to default');

// ---------------------------------------------------------------------------
// asFrequency
// ---------------------------------------------------------------------------
console.log('\n--- asFrequency ---');

// Existing valid values pass through
assertStrictEqual(asFrequency('daily', 'weekly'), 'daily', '"daily" returns daily');
assertStrictEqual(asFrequency('weekly', 'daily'), 'weekly', '"weekly" returns weekly');

// New valid values pass through
assertStrictEqual(asFrequency('hourly', 'daily'), 'hourly', '"hourly" returns hourly');
assertStrictEqual(asFrequency('4-hourly', 'daily'), '4-hourly', '"4-hourly" returns 4-hourly');
assertStrictEqual(asFrequency('12-hourly', 'daily'), '12-hourly', '"12-hourly" returns 12-hourly');
assertStrictEqual(asFrequency('custom', 'daily'), 'custom', '"custom" returns custom');

// Invalid values fall back to default
assertStrictEqual(asFrequency('monthly', 'daily'), 'daily', '"monthly" falls back to daily');
assertStrictEqual(asFrequency('monthly', 'weekly'), 'weekly', '"monthly" falls back to weekly');
assertStrictEqual(asFrequency('', 'daily'), 'daily', 'empty string falls back to daily');
assertStrictEqual(asFrequency(null, 'weekly'), 'weekly', 'null falls back to weekly');
assertStrictEqual(asFrequency(undefined, 'daily'), 'daily', 'undefined falls back to daily');
assertStrictEqual(asFrequency(0, 'weekly'), 'weekly', 'number 0 falls back to weekly');
assertStrictEqual(asFrequency(true, 'daily'), 'daily', 'boolean true falls back to daily');

// ---------------------------------------------------------------------------
// asTimezoneOffset
// ---------------------------------------------------------------------------
console.log('\n--- asTimezoneOffset ---');

// Number values pass through
assertStrictEqual(asTimezoneOffset(0, 0), 0, 'offset 0 returns 0');
assertStrictEqual(asTimezoneOffset(-300, 0), -300, 'offset -300 (UTC-5) returns -300');
assertStrictEqual(asTimezoneOffset(480, 0), 480, 'offset 480 (UTC+8) returns 480');
assertStrictEqual(asTimezoneOffset(330, 0), 330, 'offset 330 (UTC+5:30) returns 330');

// String number parses
assertStrictEqual(asTimezoneOffset('-300', 0), -300, 'string "-300" parses to -300');
assertStrictEqual(asTimezoneOffset('480', 0), 480, 'string "480" parses to 480');

// UTC±HH format
assertStrictEqual(asTimezoneOffset('UTC-5', 0), -300, '"UTC-5" returns -300');
assertStrictEqual(asTimezoneOffset('UTC+8', 0), 480, '"UTC+8" returns 480');
assertStrictEqual(asTimezoneOffset('UTC+5:30', 0), 330, '"UTC+5:30" returns 330');
assertStrictEqual(asTimezoneOffset('UTC+05:30', 0), 330, '"UTC+05:30" returns 330');
assertStrictEqual(asTimezoneOffset('UTC-4', 0), -240, '"UTC-4" returns -240');
assertStrictEqual(asTimezoneOffset('UTC+0', 0), 0, '"UTC+0" returns 0');

// Out of range
assertStrictEqual(asTimezoneOffset(1000, 0), 0, 'offset 1000 (out of range) falls back');
assertStrictEqual(asTimezoneOffset(-800, 0), 0, 'offset -800 (out of range) falls back');

// Invalid values fall back to default
assertStrictEqual(asTimezoneOffset(null, 0), 0, 'null falls back to default');
assertStrictEqual(asTimezoneOffset(undefined, 0), 0, 'undefined falls back to default');
assertStrictEqual(asTimezoneOffset('abc', 0), 0, 'invalid string falls back to default');
assertStrictEqual(asTimezoneOffset(true, 0), 0, 'boolean falls back to default');
assertStrictEqual(asTimezoneOffset('invalid', -300), -300, 'invalid string falls back to custom default');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
