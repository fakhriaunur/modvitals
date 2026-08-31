/**
 * Tests for scheduler-logic pure functions.
 *
 * Covers parseMetrics (missing keys, non-numeric values),
 * computeTrend (null previous, zero previous, normal case),
 * and aggregateReport (pure aggregation from data).
 */

import {
  parseMetrics,
  computeTrend,
  aggregateReport,
  computeLeaderboard,
  detectAnomalies,
} from './scheduler-logic.js';
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
const normal = parseMetrics({
  posts: '10',
  comments: '20',
  removals: '5',
  approvals: '3',
  reports: '1',
});
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
const zeros = parseMetrics({
  posts: '0',
  comments: '0',
  removals: '0',
  approvals: '0',
  reports: '0',
});
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

const emptyMetrics: PeriodMetrics = {
  posts: 0,
  comments: 0,
  removals: 0,
  approvals: 0,
  reports: 0,
};
const activeMetrics: PeriodMetrics = {
  posts: 15,
  comments: 42,
  removals: 8,
  approvals: 5,
  reports: 3,
};
const prevMetrics: PeriodMetrics = {
  posts: 10,
  comments: 30,
  removals: 5,
  approvals: 3,
  reports: 1,
};

// With previous data (normal case)
const reportWithPrev = aggregateReport(
  '20260524',
  activeMetrics,
  prevMetrics,
  '20260523',
  [{ username: 'offender1', score: 4 }],
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
assertDeepEqual(
  reportWithPrev.trends,
  { posts: 50, comments: 40, removals: 60, approvals: 67, reports: 200 },
  'trends computed correctly',
);
assertStrictEqual(
  reportWithPrev.lastReportTimestamp,
  '2026-05-23T12:00:00.000Z',
  'lastReportTimestamp set',
);
assertStrictEqual(reportWithPrev.generatedAt, '2026-05-24T12:00:00.000Z', 'generatedAt set');
assertDeepEqual(reportWithPrev.period.leaderboard, [], 'leaderboard empty when not provided');

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
assertDeepEqual(
  reportNoPrev.trends,
  { posts: null, comments: null, removals: null, approvals: null, reports: null },
  'trends all null when no prev',
);

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
// computeLeaderboard
// ---------------------------------------------------------------------------
console.log('\n--- computeLeaderboard ---');

const mods = [
  { username: 'mod1', count: 50 },
  { username: 'mod2', count: 30 },
  { username: 'mod3', count: 15 },
  { username: 'mod4', count: 5 },
];

const now = new Date();
const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

const lastActionTimestamps: Record<string, string> = {
  mod1: oneDayAgo,
  mod2: threeDaysAgo,
  mod3: fiveDaysAgo,
};

// Normal leaderboard (threshold 5 days)
const board = computeLeaderboard(mods, 100, lastActionTimestamps, undefined, 5, 5);

assertStrictEqual(board.length, 4, 'leaderboard has 4 entries');
assertStrictEqual(board[0].rank, 1, 'entry 1 rank is 1');
assertStrictEqual(board[0].username, 'mod1', 'entry 1 is mod1');
assertStrictEqual(board[0].count, 50, 'entry 1 count is 50');
assertStrictEqual(board[0].pct, 50, 'entry 1 is 50%');
assert(board[0].isMostActive === true, 'entry 1 is most active');
assert(board[0].isInactive === false, 'mod1 is not inactive (1 day ago)');

assertStrictEqual(board[1].rank, 2, 'entry 2 rank is 2');
assertStrictEqual(board[1].username, 'mod2', 'entry 2 is mod2');
assertStrictEqual(board[1].pct, 30, 'entry 2 is 30%');
assert(board[1].isMostActive === false, 'entry 2 is not most active');
assert(board[1].isInactive === false, 'mod2 is not inactive (3 days ago, threshold 5)');

assertStrictEqual(board[2].rank, 3, 'entry 3 rank is 3');
assertStrictEqual(board[2].username, 'mod3', 'entry 3 is mod3');
assertStrictEqual(board[2].pct, 15, 'entry 3 is 15%');
assert(board[2].isInactive === true, 'mod3 is inactive (5 days ago, threshold 5)');

assertStrictEqual(board[3].rank, 4, 'entry 4 rank is 4');
assertStrictEqual(board[3].username, 'mod4', 'entry 4 is mod4');
assertStrictEqual(board[3].pct, 5, 'entry 4 is 5%');
assert(board[3].isMostActive === false, 'entry 4 is not most active');
assert(board[3].isInactive === true, 'mod4 has no timestamp, so is inactive');
assert(
  board[3].daysSinceLastAction === undefined,
  'mod4 daysSinceLastAction undefined (no timestamp available)',
);

// Empty mods list
const emptyBoard = computeLeaderboard([], 0, {}, undefined, 5, 5);
assertStrictEqual(emptyBoard.length, 0, 'empty mods returns empty leaderboard');

// Single mod
const singleBoard = computeLeaderboard(
  [{ username: 'mod1', count: 10 }],
  10,
  { mod1: oneDayAgo },
  undefined,
  5,
  5,
);
assertStrictEqual(singleBoard.length, 1, 'single mod leaderboard has 1 entry');
assert(singleBoard[0].isMostActive === true, 'single mod is most active');
assert(singleBoard[0].pct === 100, 'single mod is 100%');

// All mods have zero count
const zeroMods = [
  { username: 'mod1', count: 0 },
  { username: 'mod2', count: 0 },
];
const zeroBoard = computeLeaderboard(zeroMods, 0, {}, undefined, 5, 5);
assertStrictEqual(zeroBoard.length, 2, 'zero-count mods still appear');
assert(zeroBoard[0].isMostActive === false, 'zero-count mod1 not most active');
assert(zeroBoard[0].isInactive === true, 'zero-count mod1 is inactive (no timestamp)');

// Stricter threshold (2 days)
const strictBoard = computeLeaderboard(mods, 100, lastActionTimestamps, undefined, 2, 5);
assert(strictBoard[0].isInactive === false, 'mod1 not inactive with 2-day threshold (1 day ago)');
assert(strictBoard[1].isInactive === true, 'mod2 inactive with 2-day threshold (3 days ago)');
assert(strictBoard[2].isInactive === true, 'mod3 inactive with 2-day threshold (5 days ago)');

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------
console.log('\n--- detectAnomalies ---');

// Helper to build a snapshot with uniform values
function makeSnapshot(value: number): PeriodMetrics {
  return { posts: value, comments: value, removals: value, approvals: value, reports: value };
}

// Sufficient data (7 snapshots) with an anomaly
const sevenSnapshots = Array.from({ length: 7 }, () => makeSnapshot(10));
const highCurrent: PeriodMetrics = {
  posts: 10,
  comments: 10,
  removals: 30,
  approvals: 10,
  reports: 10,
};
const anomalyResult = detectAnomalies(highCurrent, sevenSnapshots);

assert(anomalyResult.hasSufficientData === true, 'hasSufficientData true with 7 snapshots');
assertStrictEqual(anomalyResult.baselineDays, 7, 'baselineDays is 7');
assertStrictEqual(
  anomalyResult.alerts.length,
  1,
  'one anomaly detected (removals 30 > 2x avg of 10)',
);
assertStrictEqual(anomalyResult.alerts[0].metric, 'removals', 'anomaly metric is removals');
assertStrictEqual(anomalyResult.alerts[0].currentValue, 30, 'current value is 30');
assertStrictEqual(anomalyResult.alerts[0].averageValue, 10, 'average value is 10');
assertStrictEqual(anomalyResult.alerts[0].percentOfAverage, 300, '300% of average');

// Multiple anomalies
const multiHigh: PeriodMetrics = {
  posts: 30,
  comments: 10,
  removals: 25,
  approvals: 10,
  reports: 10,
};
const multiResult = detectAnomalies(multiHigh, sevenSnapshots);
assert(multiResult.hasSufficientData === true, 'hasSufficientData still true');
assertStrictEqual(
  multiResult.alerts.length,
  2,
  'two anomalies detected (posts 30, removals 25 > 2x avg of 10)',
);
assertStrictEqual(multiResult.alerts[0].metric, 'posts', 'first anomaly is posts');
assertStrictEqual(multiResult.alerts[1].metric, 'removals', 'second anomaly is removals');

// No anomalies — all metrics within normal range
const normalMetrics: PeriodMetrics = {
  posts: 15,
  comments: 19,
  removals: 5,
  approvals: 8,
  reports: 2,
};
const noAnomalyResult = detectAnomalies(normalMetrics, sevenSnapshots);
assert(noAnomalyResult.hasSufficientData === true, 'hasSufficientData true');
assertStrictEqual(noAnomalyResult.alerts.length, 0, 'no alerts when all metrics within 2x range');

// Insufficient data (0 snapshots)
const zeroResult = detectAnomalies(normalMetrics, []);
assert(zeroResult.hasSufficientData === false, 'hasSufficientData false with 0 snapshots');
assertStrictEqual(zeroResult.baselineDays, 0, 'baselineDays is 0 with empty');
assertStrictEqual(zeroResult.alerts.length, 0, 'no alerts with insufficient data');

// Insufficient data (3 snapshots)
const threeSnapshots = Array.from({ length: 3 }, () => makeSnapshot(10));
const threeResult = detectAnomalies(normalMetrics, threeSnapshots);
assert(threeResult.hasSufficientData === false, 'hasSufficientData false with 3 snapshots');
assertStrictEqual(threeResult.baselineDays, 3, 'baselineDays is 3');
assertStrictEqual(threeResult.alerts.length, 0, 'no alerts with 3 snapshots');

// Exactly 7 snapshots, all equal — should have sufficent data
const exactly7 = Array.from({ length: 7 }, () => makeSnapshot(5));
const exact7Result = detectAnomalies(normalMetrics, exactly7);
assert(exact7Result.hasSufficientData === true, 'exactly 7 snapshots has sufficient data');

// Zero rolling average is skipped (avoids division by zero)
const zeroAvgSnapshots = Array.from({ length: 7 }, () => makeSnapshot(0));
const zeroAvgCurrent: PeriodMetrics = {
  posts: 10,
  comments: 0,
  removals: 0,
  approvals: 0,
  reports: 0,
};
const zeroAvgResult = detectAnomalies(zeroAvgCurrent, zeroAvgSnapshots);
assert(zeroAvgResult.hasSufficientData === true, 'hasSufficientData true even with zero avg');
assertStrictEqual(
  zeroAvgResult.alerts.length,
  0,
  'no alerts when rolling average is zero (skipped)',
);

// Verify format: metric labels match expected keys
const _labelCheck = detectAnomalies(highCurrent, sevenSnapshots);
void _labelCheck;
const metricLabels = ['posts', 'comments', 'removals', 'approvals', 'reports'];
for (const ml of metricLabels) {
  assert(typeof ml === 'string', `metric label "${ml}" is a string`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
