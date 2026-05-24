/**
 * Tests for report formatting logic.
 *
 * These tests validate the pure formatting functions in report.ts
 * by constructing mock ReportData objects and checking the output.
 *
 * Run with: npx tsx src/server/report.test.ts
 * Or: node --experimental-strip-types src/server/report.test.ts
 */

import type { ReportData } from './scheduler.js';
import { formatReport, buildReportTitle } from './report.js';

// ---------------------------------------------------------------------------
// Mock data builders
// ---------------------------------------------------------------------------

function makeEmptyReport(): ReportData {
  return {
    generatedAt: '2026-05-24T12:00:00.000Z',
    period: {
      dateKey: '20260524',
      metrics: { posts: 0, comments: 0, removals: 0, approvals: 0, reports: 0 },
      topRules: [],
      topActionTypes: [],
      topMods: [],
      topOffenders: [],
    },
    previousPeriod: {
      exists: false,
      dateKey: null,
      metrics: null,
      topRules: [],
      topMods: [],
    },
    trends: { posts: null, comments: null, removals: null, approvals: null },
    lastReportTimestamp: undefined,
  };
}

function makeActiveReport(): ReportData {
  return {
    generatedAt: '2026-05-24T12:00:00.000Z',
    period: {
      dateKey: '20260524',
      metrics: { posts: 15, comments: 42, removals: 8, approvals: 5, reports: 3 },
      topRules: [
        { rule: 'No Spam', count: 5 },
        { rule: 'Be Civil', count: 3 },
        { rule: 'No Self-Promotion', count: 1 },
      ],
      topActionTypes: [
        { action: 'removelink', count: 6 },
        { action: 'approvelink', count: 3 },
        { action: 'banuser', count: 2 },
      ],
      topMods: [
        { username: 'mod1', count: 10 },
        { username: 'mod2', count: 5 },
        { username: 'mod3', count: 2 },
      ],
      topOffenders: [
        { member: 'offender1', score: 4 },
        { member: 'offender2', score: 2 },
      ],
    },
    previousPeriod: {
      exists: true,
      dateKey: '20260523',
      metrics: { posts: 10, comments: 30, removals: 5, approvals: 3, reports: 1 },
      topRules: [{ rule: 'No Spam', count: 3 }],
      topMods: [{ username: 'mod1', count: 7 }],
    },
    trends: {
      posts: 50,       // 50% increase
      comments: 40,    // 40% increase
      removals: 60,    // 60% increase
      approvals: 67,   // 67% increase
    },
    lastReportTimestamp: '2026-05-23T12:00:00.000Z',
  };
}

function makeReportWithNegativeTrends(): ReportData {
  return {
    generatedAt: '2026-05-24T12:00:00.000Z',
    period: {
      dateKey: '20260524',
      metrics: { posts: 5, comments: 10, removals: 2, approvals: 1, reports: 0 },
      topRules: [
        { rule: 'No Spam', count: 2 },
      ],
      topActionTypes: [],
      topMods: [
        { username: 'mod1', count: 3 },
      ],
      topOffenders: [
        { member: 'offender1', score: 2 },
      ],
    },
    previousPeriod: {
      exists: true,
      dateKey: '20260523',
      metrics: { posts: 20, comments: 40, removals: 10, approvals: 5, reports: 2 },
      topRules: [],
      topMods: [],
    },
    trends: {
      posts: -75,      // 75% decrease
      comments: -75,
      removals: -80,
      approvals: -80,
    },
    lastReportTimestamp: '2026-05-23T12:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
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

function assertContains(text: string, substring: string, message: string): void {
  if (text.includes(substring)) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected to find "${substring}"`);
  }
}

function assertNotContains(text: string, substring: string, message: string): void {
  if (!text.includes(substring)) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — found unexpected "${substring}"`);
  }
}

// ---------------------------------------------------------------------------
// Test: Empty report
// ---------------------------------------------------------------------------
console.log('\n--- Empty Report ---');

const emptyReport = makeEmptyReport();
const emptyTitle = buildReportTitle(emptyReport);
const emptyBody = formatReport(emptyReport);

assert(
  emptyTitle.includes('No Activity'),
  'Title includes "No Activity" for empty report',
);
assertContains(
  emptyBody,
  'No activity in this period',
  'Body includes "No activity in this period" for empty report',
);

// ---------------------------------------------------------------------------
// Test: Active report with all sections
// ---------------------------------------------------------------------------
console.log('\n--- Active Report ---');

const activeReport = makeActiveReport();
const activeTitle = buildReportTitle(activeReport);
const activeBody = formatReport(activeReport);

assert(
  !activeTitle.includes('No Activity'),
  'Title does NOT include "No Activity" for active report',
);

assertContains(activeTitle, 'May 24, 2026', 'Title includes formatted date');

// Overview section
assertContains(activeBody, '### Overview', 'Has Overview section');
assertContains(activeBody, '▲ (50% up)', 'Has upward trend indicator for posts');
assertContains(activeBody, '▲ (40% up)', 'Has upward trend indicator for comments');
assertContains(activeBody, '▲ (60% up)', 'Has upward trend indicator for removals');
assertContains(activeBody, '▲ (67% up)', 'Has upward trend indicator for approvals');

// Activity Summary section
assertContains(activeBody, '### Activity Summary', 'Has Activity Summary section');
assertContains(activeBody, 'Total submissions', 'Has total submissions count');
assertContains(activeBody, 'Removal rate', 'Has removal rate');
assertContains(activeBody, 'Approval rate', 'Has approval rate');

// Rule Violations section
assertContains(activeBody, '### Rule Violations', 'Has Rule Violations section');
assertContains(activeBody, 'No Spam', 'Includes rule name "No Spam"');
assertContains(activeBody, 'Be Civil', 'Includes rule name "Be Civil"');
assertContains(activeBody, '5 violation', 'Includes rule count');

// Repeat Offenders section
assertContains(activeBody, '### Repeat Offenders', 'Has Repeat Offenders section');
assertContains(activeBody, 'u/offender1', 'Includes offender username');
assertContains(activeBody, '4 incidents', 'Includes offender score');

// Mod Activity section
assertContains(activeBody, '### Mod Activity', 'Has Mod Activity section');
assertContains(activeBody, 'u/mod1', 'Includes mod username');
assertContains(activeBody, '10 actions', 'Includes mod action count');
assertContains(activeBody, 'Action Breakdown', 'Has action breakdown');
assertContains(activeBody, 'removelink', 'Includes action type');

// Previous period comparison
assertContains(activeBody, 'Comparison period', 'Includes comparison period note');
assertContains(activeBody, 'May 23, 2026', 'Includes previous period date');

// ---------------------------------------------------------------------------
// Test: Report with negative trends
// ---------------------------------------------------------------------------
console.log('\n--- Negative Trends Report ---');

const negativeReport = makeReportWithNegativeTrends();
const negativeBody = formatReport(negativeReport);

assertContains(negativeBody, '▼ (75% down)', 'Has downward trend indicator');
assertContains(negativeBody, '▼ (80% down)', 'Has downward trend indicator for removals');

// ---------------------------------------------------------------------------
// Test: Section headers present
// ---------------------------------------------------------------------------
console.log('\n--- Section Headers ---');

const body = formatReport(makeActiveReport());

const expectedSections = [
  '# ModVitals Health Report',
  '### Overview',
  '### Activity Summary',
  '### Rule Violations',
  '### Repeat Offenders',
  '### Mod Activity',
];

for (const section of expectedSections) {
  assertContains(body, section, `Section header present: ${section}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
