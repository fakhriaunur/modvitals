/**
 * Tests for karma pure functions.
 *
 * Covers formatKarmaDisplay, formatAccountAge, formatTotalKarma,
 * and formatSubredditKarma.
 *
 * Run with: npx tsx src/server/karma.test.ts
 */

import {
  formatKarmaDisplay,
  formatAccountAge,
  formatTotalKarma,
  formatSubredditKarma,
} from './karma.js';

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

function assertStrictEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected "${String(expected)}", got "${String(actual)}"`);
  }
}

// ---------------------------------------------------------------------------
// formatKarmaDisplay
// ---------------------------------------------------------------------------
console.log('\n--- formatKarmaDisplay ---');

assertStrictEqual(formatKarmaDisplay(0), '0', 'zero returns "0"');
assertStrictEqual(formatKarmaDisplay(5), '5', 'small number returns raw');
assertStrictEqual(formatKarmaDisplay(999), '999', '999 returns raw');
assertStrictEqual(formatKarmaDisplay(1000), '1.0k', '1000 returns "1.0k"');
assertStrictEqual(formatKarmaDisplay(1234), '1.2k', '1234 returns "1.2k"');
assertStrictEqual(formatKarmaDisplay(1500), '1.5k', '1500 returns "1.5k"');
assertStrictEqual(formatKarmaDisplay(10000), '10.0k', '10000 returns "10.0k"');
assertStrictEqual(formatKarmaDisplay(12345), '12.3k', '12345 returns "12.3k"');
assertStrictEqual(formatKarmaDisplay(100000), '100.0k', '100000 returns "100.0k"');
assertStrictEqual(formatKarmaDisplay(-500), '-500', 'negative small number');
assertStrictEqual(formatKarmaDisplay(-1500), '-1.5k', 'negative large number');

// ---------------------------------------------------------------------------
// formatAccountAge
// ---------------------------------------------------------------------------
console.log('\n--- formatAccountAge ---');

const now = new Date();

// Created just now — 0mo
const zeroMo = new Date(now);
assertStrictEqual(formatAccountAge(zeroMo, now), '0mo account', 'just created shows 0mo');

// Created 3 months ago
const threeMoAgo = new Date(now);
threeMoAgo.setUTCMonth(now.getUTCMonth() - 3);
assertStrictEqual(formatAccountAge(threeMoAgo, now), '3mo account', '3 months ago');

// Created 1 year ago
const oneYearAgo = new Date(now);
oneYearAgo.setUTCFullYear(now.getUTCFullYear() - 1);
// The exact output depends on current month, but should have "1y"
const oneYearResult = formatAccountAge(oneYearAgo, now);
assert(
  oneYearResult.includes('y') && oneYearResult.includes('account'),
  `1 year ago returns year-based format: "${oneYearResult}"`,
);

// Created 2 years 3 months ago
const twoYearsThreeMoAgo = new Date(now);
twoYearsThreeMoAgo.setUTCFullYear(now.getUTCFullYear() - 2);
twoYearsThreeMoAgo.setUTCMonth(now.getUTCMonth() - 3);
assertStrictEqual(
  formatAccountAge(twoYearsThreeMoAgo, now),
  '2y 3mo account',
  '2 years 3 months ago',
);

// Created long ago (5 years)
const fiveYearsAgo = new Date(now);
fiveYearsAgo.setUTCFullYear(now.getUTCFullYear() - 5);
const fiveYearResult = formatAccountAge(fiveYearsAgo, now);
assert(fiveYearResult.includes('5y'), `5 years ago shows "5y": "${fiveYearResult}"`);

// ---------------------------------------------------------------------------
// formatTotalKarma
// ---------------------------------------------------------------------------
console.log('\n--- formatTotalKarma ---');

assertStrictEqual(formatTotalKarma(0, 0), '0', 'zero link and comment karma');
assertStrictEqual(formatTotalKarma(100, 200), '300', 'sum of link and comment');
assertStrictEqual(formatTotalKarma(1000, 500), '1.5k', 'large total formats to k');
assertStrictEqual(formatTotalKarma(5000, 3000), '8.0k', '8k total');
assertStrictEqual(formatTotalKarma(-100, 50), '-50', 'negative total');

// ---------------------------------------------------------------------------
// formatSubredditKarma
// ---------------------------------------------------------------------------
console.log('\n--- formatSubredditKarma ---');

assertStrictEqual(formatSubredditKarma(undefined), null, 'undefined returns null');
assertStrictEqual(
  formatSubredditKarma({ fromComments: 0, fromPosts: 0 }),
  null,
  'zero sub karma returns null',
);
assertStrictEqual(
  formatSubredditKarma({ fromComments: 10, fromPosts: 5 }),
  '+15 sub karma',
  'positive sub karma',
);
assertStrictEqual(
  formatSubredditKarma({ fromComments: -10, fromPosts: -5 }),
  '-15 sub karma',
  'negative sub karma',
);
assertStrictEqual(
  formatSubredditKarma({ fromComments: 0, fromPosts: 5 }),
  '+5 sub karma',
  'only post karma positive',
);
assertStrictEqual(
  formatSubredditKarma({ fromComments: -5, fromPosts: 0 }),
  '-5 sub karma',
  'only comment karma negative',
);
assertStrictEqual(formatSubredditKarma({}), null, 'empty object with no fields returns null');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
