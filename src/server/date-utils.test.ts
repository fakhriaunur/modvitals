/**
 * Tests for date utility functions.
 *
 * Covers formatDate with various date keys including edge cases.
 */

import { formatDate } from './date-utils.js';

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
