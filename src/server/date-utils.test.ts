/**
 * Tests for date utility functions.
 *
 * Covers dateKeyToDate, dateToDateKey, getTodayDateKey, getRelativeDateKey,
 * and formatDate with various date keys including edge cases.
 */

import { dateKeyToDate, dateToDateKey, getTodayDateKey, getRelativeDateKey, formatDate } from './date-utils.js';

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

function assertStrictEqual(actual: string, expected: string, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected "${expected}", got "${actual}"`);
  }
}

// ---------------------------------------------------------------------------
// dateKeyToDate
// ---------------------------------------------------------------------------
console.log('\n--- dateKeyToDate ---');

const d1 = dateKeyToDate('20260524');
assert(d1 instanceof Date, 'returns a Date object');
assertStrictEqual(d1.toISOString().slice(0, 10), '2026-05-24', 'parses date key to correct UTC date');

const d2 = dateKeyToDate('20260101');
assertStrictEqual(d2.toISOString().slice(0, 10), '2026-01-01', 'parses year boundary date');

const d3 = dateKeyToDate('20240229');
assertStrictEqual(d3.toISOString().slice(0, 10), '2024-02-29', 'parses leap year date');

// ---------------------------------------------------------------------------
// dateToDateKey
// ---------------------------------------------------------------------------
console.log('\n--- dateToDateKey ---');

assertStrictEqual(dateToDateKey(new Date(Date.UTC(2026, 4, 24))), '20260524', 'converts Date to date key');
assertStrictEqual(dateToDateKey(new Date(Date.UTC(2026, 0, 1))), '20260101', 'converts January date');
assertStrictEqual(dateToDateKey(new Date(Date.UTC(2026, 11, 31))), '20261231', 'converts December date');
assertStrictEqual(dateToDateKey(new Date(Date.UTC(2024, 1, 29))), '20240229', 'converts leap year date');

// ---------------------------------------------------------------------------
// getTodayDateKey
// ---------------------------------------------------------------------------
console.log('\n--- getTodayDateKey ---');

const todayKey = getTodayDateKey();
assert(typeof todayKey === 'string', 'returns a string');
assert(todayKey.length === 8, 'returns 8-character string');
assert(!isNaN(parseInt(todayKey, 10)), 'returns numeric string');

// ---------------------------------------------------------------------------
// getRelativeDateKey
// ---------------------------------------------------------------------------
console.log('\n--- getRelativeDateKey ---');

// Previous day
assertStrictEqual(getRelativeDateKey('20260524', -1), '20260523', 'gets previous day');
// Next day
assertStrictEqual(getRelativeDateKey('20260524', 1), '20260525', 'gets next day');
// Month boundary
assertStrictEqual(getRelativeDateKey('20260501', -1), '20260430', 'crosses month boundary backward');
assertStrictEqual(getRelativeDateKey('20260430', 1), '20260501', 'crosses month boundary forward');
// Year boundary
assertStrictEqual(getRelativeDateKey('20260101', -1), '20251231', 'crosses year boundary backward');
assertStrictEqual(getRelativeDateKey('20251231', 1), '20260101', 'crosses year boundary forward');
// Leap year
assertStrictEqual(getRelativeDateKey('20240301', -1), '20240229', 'leap year February 29');
assertStrictEqual(getRelativeDateKey('20240228', 1), '20240229', 'leap year February 28 → 29');
// Zero offset
assertStrictEqual(getRelativeDateKey('20260524', 0), '20260524', 'zero offset returns same date');
// Larger offset
assertStrictEqual(getRelativeDateKey('20260524', -7), '20260517', 'negative offset of 7 days');
assertStrictEqual(getRelativeDateKey('20260524', 30), '20260623', 'positive offset of 30 days');

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
console.log('\n--- formatDate ---');

// Normal date
assertStrictEqual(formatDate('20260524'), 'May 24, 2026', 'formats normal date correctly');

// January (month 01)
assertStrictEqual(formatDate('20260115'), 'January 15, 2026', 'formats January date correctly');

// December (month 12)
assertStrictEqual(formatDate('20251225'), 'December 25, 2025', 'formats December date correctly');

// First day of month
assertStrictEqual(formatDate('20260301'), 'March 1, 2026', 'formats first day of month correctly');

// Leap year date
assertStrictEqual(formatDate('20240229'), 'February 29, 2024', 'formats leap year date correctly');

// Single-digit day
assertStrictEqual(formatDate('20260505'), 'May 5, 2026', 'formats single-digit day correctly');

// Year boundary
assertStrictEqual(formatDate('20251231'), 'December 31, 2025', 'formats year-end date correctly');
assertStrictEqual(formatDate('20260101'), 'January 1, 2026', 'formats year-start date correctly');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
