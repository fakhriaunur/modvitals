/**
 * Tests for scheduler-logic pure functions.
 *
 * Covers parseMetrics (missing keys, non-numeric values),
 * computeTrend (null previous, zero previous, normal case),
 * and aggregateReport (pure aggregation from data).
 */

import { parseMetrics, computeTrend, aggregateReport } from './scheduler-logic.js';
import type { PeriodMetrics } from './scheduler-logic.js';

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

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected ${expectedJson}, got ${actualJson}`);
  }
}

// ---------------------------------------------------------------------------
// parseMetrics
// ---------------------------------------------------------------------------
console.log('\n--- parseMetrics ---');

// Normal case
const normal = parseMetrics({ posts: '10', comments: '20', removals: '5', approvals: '3', reports: '1' });
assertStrictEqual(normal.posts, 10, 'parses posts');
assertStrictEqual(normal.comments, 20, 'parses comments');
assertStrictEqual(normal.removals, 5, 'parses removals');
assertStrictEqual(normal.approvals, 3, 'parses approvals');
assertStrictEqual(normal.reports, 1, 'parses reports');

// Missing keys — defaults to 0
const missing = parseMetrics({});
assertStrictEqual(missing.posts, 0, 'missing posts defaults to 0');
assertStrictEqual(missing.comments, 0, 'missing comments defaults to 0');
assertStrictEqual(missing.removals, 0, 'missing removals defaults to 0');
assertStrictEqual(missing.approvals, 0, 'missing approvals defaults to 0');
assertStrictEqual(missing.reports, 0, 'missing reports defaults to 0');

// Non-numeric values — defaults to 0
const nonNumeric = parseMetrics({
  posts: 'abc',
  comments: 'NaN',
  removals: '',
  approvals: '12.5',
  reports: 'null',
});
assertStrictEqual(nonNumeric.posts, 0, 'non-numeric posts defaults to 0');
assertStrictEqual(nonNumeric.comments, 0, 'NaN comments defaults to 0');
assertStrictEqual(nonNumeric.removals, 0, 'empty string removals defaults to 0');
// '12.5' — parseInt('12.5') returns 12, so || 0 gives 12 since parseInt('12.5') = 12 which is truthy
assertStrictEqual(nonNumeric.approvals, 12, 'float string approvals parses to integer');
assertStrictEqual(nonNumeric.reports, 0, 'null string reports defaults to 0');

// Partial keys
const partial = parseMetrics({ posts: '7', removals: '3' });
assertStrictEqual(partial.posts, 7, 'partial posts parsed correctly');
assertStrictEqual(partial.comments, 0, 'partial missing comments defaults to 0');
assertStrictEqual(partial.removals, 3, 'partial removals parsed correctly');
assertStrictEqual(partial.approvals, 0, 'partial missing approvals defaults to 0');
assertStrictEqual(partial.reports, 0, 'partial missing reports defaults to 0');

// Zero values
const zeros = parseMetrics({ posts: '0', comments: '0', removals: '0', approvals: '0', reports: '0' });
assertStrictEqual(zeros.posts, 0, 'zero posts parsed correctly');
assertStrictEqual(zeros.comments, 0, 'zero comments parsed correctly');

// ---------------------------------------------------------------------------
// computeTrend
// ---------------------------------------------------------------------------
console.log('\n--- computeTrend ---');

// Null previous returns null
assertStrictEqual(computeTrend(10, null), null, 'returns null when previous is null');

// Zero previous returns null
assertStrictEqual(computeTrend(10, 0), null, 'returns null when previous is 0');

// Normal case: increase
assertStrictEqual(computeTrend(15, 10), 50, '50% increase returns 50');

// Normal case: decrease
assertStrictEqual(computeTrend(5, 10), -50, '50% decrease returns -50');

// No change
assertStrictEqual(computeTrend(10, 10), 0, 'no change returns 0');

// Zero current, positive previous
assertStrictEqual(computeTrend(0, 10), -100, 'zero current with previous returns -100');

// Large values
assertStrictEqual(computeTrend(200, 100), 100, '100% increase returns 100');

// Rounding: 1/3 = 33.33... rounds to 33
assertStrictEqual(computeTrend(4, 3), 33, '33.33% rounds to 33');

// Rounding: 2/3 = 66.66... rounds to 67
assertStrictEqual(computeTrend(5, 3), 67, '66.67% rounds to 67');

// ---------------------------------------------------------------------------
// aggregateReport
// ---------------------------------------------------------------------------
console.log('\n--- aggregateReport ---');

const emptyMetrics: PeriodMetrics = { posts: 0, comments: 0, removals: 0, approvals: 0, reports: 0 };
const activeMetrics: PeriodMetrics = { posts: 15, comments: 42, removals: 8, approvals: 5, reports: 3 };
const prevMetrics: PeriodMetrics = { posts: 10, comments: 30, removals: 5, approvals: 3, reports: 1 };

// With previous data (normal case)
const reportWithPrev = aggregateReport(
  '20260524',
  activeMetrics,
  prevMetrics,
  '20260523',
  [{ member: 'offender1', score: 4 }],
  [{ username: 'mod1', count: 10 }],
  [{ rule: 'No Spam', count: 5 }],
  [{ action: 'removelink', count: 6 }],
  [{ username: 'mod1', count: 7 }],
  [{ rule: 'No Spam', count: 3 }],
  '2026-05-23T12:00:00.000Z',
  '2026-05-24T12:00:00.000Z',
);

assertStrictEqual(reportWithPrev.period.dateKey, '20260524', 'sets dateKey');
assertStrictEqual(reportWithPrev.previousPeriod.exists, true, 'prev exists flag true');
assertStrictEqual(reportWithPrev.previousPeriod.dateKey, '20260523', 'prev dateKey set');
assertDeepEqual(reportWithPrev.trends, { posts: 50, comments: 40, removals: 60, approvals: 67 }, 'trends computed correctly');
assertStrictEqual(reportWithPrev.lastReportTimestamp, '2026-05-23T12:00:00.000Z', 'lastReportTimestamp set');
assertStrictEqual(reportWithPrev.generatedAt, '2026-05-24T12:00:00.000Z', 'generatedAt set');

// Without previous data
const reportNoPrev = aggregateReport(
  '20260524',
  activeMetrics,
  null,
  null,
  [],
  [],
  [],
  [],
  [],
  [],
  undefined,
  '2026-05-24T12:00:00.000Z',
);

assertStrictEqual(reportNoPrev.previousPeriod.exists, false, 'prev exists flag false when null');
assertStrictEqual(reportNoPrev.previousPeriod.dateKey, null, 'prev dateKey null when no prev');
assertStrictEqual(reportNoPrev.previousPeriod.metrics, null, 'prev metrics null when no prev');
assertDeepEqual(reportNoPrev.trends, { posts: null, comments: null, removals: null, approvals: null }, 'trends all null when no prev');

// Empty metrics
const reportEmpty = aggregateReport(
  '20260524',
  emptyMetrics,
  null,
  null,
  [],
  [],
  [],
  [],
  [],
  [],
  undefined,
  '2026-05-24T12:00:00.000Z',
);

assertStrictEqual(reportEmpty.period.metrics.posts, 0, 'empty metrics posts is 0');
assertStrictEqual(reportEmpty.period.topRules.length, 0, 'empty topRules');
assertStrictEqual(reportEmpty.period.topOffenders.length, 0, 'empty topOffenders');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
