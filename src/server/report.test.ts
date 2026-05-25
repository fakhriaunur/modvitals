/**
 * Tests for report formatting logic.
 *
 * These tests validate the pure formatting functions in report.ts
 * by constructing mock ReportData objects and checking the output.
 *
 * Run with: npx tsx src/server/report.test.ts
 * Or: node --experimental-strip-types src/server/report.test.ts
 */

import type { ReportData } from './scheduler-logic.js';
import { formatReport, buildReportTitle } from './report.js';
import type { ModVitalsSettings } from './settings.js';

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
      offenderKarma: {},
      leaderboard: [],
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
        { username: 'offender1', score: 4 },
        { username: 'offender2', score: 2 },
      ],
      offenderKarma: {},
      leaderboard: [],
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
        { username: 'offender1', score: 2 },
      ],
      offenderKarma: {},
      leaderboard: [],
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

/**
 * Report with karma-enriched offender data.
 */
function makeReportWithKarma(): ReportData {
  return {
    generatedAt: '2026-05-24T12:00:00.000Z',
    period: {
      dateKey: '20260524',
      metrics: { posts: 15, comments: 42, removals: 8, approvals: 5, reports: 3 },
      topRules: [
        { rule: 'No Spam', count: 5 },
      ],
      topActionTypes: [],
      topMods: [],
      topOffenders: [
        { username: 'offender1', score: 4 },
        { username: 'offender2', score: 2 },
      ],
      offenderKarma: {
        offender1: {
          linkKarma: 1200,
          commentKarma: 800,
          accountCreatedAt: new Date('2023-02-15T00:00:00.000Z'),
          snoovatarUrl: 'https://example.com/snoovatar1.png',
          subredditKarma: { fromComments: -10, fromPosts: -5 },
        },
        offender2: {
          linkKarma: 50,
          commentKarma: 200,
          accountCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
          // no snoovatar, no subreddit karma
        },
      },
      leaderboard: [],
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
// Test: Karma enrichment in Repeat Offenders section
// ---------------------------------------------------------------------------
console.log('\n--- Karma Enrichment ---');

const karmaReport = makeReportWithKarma();
const karmaBody = formatReport(karmaReport);

// Karma stats should appear when data is present
assertContains(karmaBody, '**u/offender1**', 'Offender1 username present');
assertContains(karmaBody, '**u/offender2**', 'Offender2 username present');
assertContains(karmaBody, 'account', 'Account age indicator present');
assertContains(karmaBody, 'karma', 'Karma label present');
assertContains(karmaBody, 'sub karma', 'Subreddit karma label present');
assertContains(karmaBody, '2.0k karma', 'Total karma formatted (1200+800=2000 → 2.0k)');
assertContains(karmaBody, '-15 sub karma', 'Negative subreddit karma shown');
assertContains(karmaBody, '250 karma', 'Offender2 total karma (50+200=250)');
assertContains(karmaBody, 'snoovatar', 'Snoovatar URL rendered');
assertContains(karmaBody, '4 incidents', 'Offender1 incident count');
assertContains(karmaBody, '2 incidents', 'Offender2 incident count');

// Karma stats hidden when settings explicitly disable
const settingsHideKarma: ModVitalsSettings = {
  reportFrequency: 'daily',
  reportHour: 12,
  showPosts: true,
  showComments: true,
  showRemovals: true,
  showApprovals: true,
  showRuleViolations: true,
  showTopOffenders: true,
  showModActivity: true,
  showKarmaStats: false,
  showLeaderboard: true,
  showInactiveAlerts: true,
  inactiveThresholdDays: 5,
};
const karmaBodyHidden = formatReport(karmaReport, settingsHideKarma);
assertNotContains(karmaBodyHidden, 'account', 'Account age hidden when showKarmaStats=false');
assertNotContains(karmaBodyHidden, 'karma', 'Karma label hidden when showKarmaStats=false');
// Username and incident count still shown
assertContains(karmaBodyHidden, '**u/offender1**', 'Username still shown when karma hidden');
assertContains(karmaBodyHidden, '4 incidents', 'Incident count still shown when karma hidden');

// ---------------------------------------------------------------------------
// Test: Leaderboard in Mod Activity section
// ---------------------------------------------------------------------------
console.log('\n--- Leaderboard & Inactive Alerts ---');

function makeReportWithLeaderboard(): ReportData {
  const base = makeActiveReport();
  return {
    ...base,
    period: {
      ...base.period,
      leaderboard: [
        { rank: 1, username: 'mod1', count: 10, pct: 50, isMostActive: true, lastActionTimestamp: new Date(Date.now() - 1 * 86400000).toISOString(), daysSinceLastAction: 1, isInactive: false },
        { rank: 2, username: 'mod2', count: 6, pct: 30, isMostActive: false, lastActionTimestamp: new Date(Date.now() - 3 * 86400000).toISOString(), daysSinceLastAction: 3, isInactive: false },
        { rank: 3, username: 'mod3', count: 3, pct: 15, isMostActive: false, lastActionTimestamp: new Date(Date.now() - 7 * 86400000).toISOString(), daysSinceLastAction: 7, isInactive: true },
        { rank: 4, username: 'mod4', count: 1, pct: 5, isMostActive: false, lastActionTimestamp: new Date(Date.now() - 10 * 86400000).toISOString(), daysSinceLastAction: 10, isInactive: true },
      ],
    },
  };
}

const lbReport = makeReportWithLeaderboard();
const lbBody = formatReport(lbReport);

// Leaderboard section
assertContains(lbBody, 'Mod Activity', 'Leaderboard: Mod Activity section present');
assertContains(lbBody, 'Top Moderators (Leaderboard)', 'Leaderboard: section header present');
assertContains(lbBody, '1. u/mod1', 'Leaderboard: ranked entry 1');
assertContains(lbBody, '2. u/mod2', 'Leaderboard: ranked entry 2');
assertContains(lbBody, '3. ⚠️ u/mod3', 'Leaderboard: inactive entry with warning');
assertContains(lbBody, '4. ⚠️ u/mod4', 'Leaderboard: inactive entry 4 with warning');
assertContains(lbBody, '[Most Active]', 'Leaderboard: Most Active badge');
assertContains(lbBody, '(50%)', 'Leaderboard: percentage for mod1');
assertContains(lbBody, '(30%)', 'Leaderboard: percentage for mod2');
assertContains(lbBody, '(15%)', 'Leaderboard: percentage for mod3');
assertContains(lbBody, '(5%)', 'Leaderboard: percentage for mod4');
assertContains(lbBody, 'Inactive 7 days', 'Leaderboard: inactive days for mod3');
assertContains(lbBody, 'Inactive 10 days', 'Leaderboard: inactive days for mod4');

// Leaderboard disabled via settings
const settingsNoLeaderboard: ModVitalsSettings = {
  reportFrequency: 'daily',
  reportHour: 12,
  showPosts: true,
  showComments: true,
  showRemovals: true,
  showApprovals: true,
  showRuleViolations: true,
  showTopOffenders: true,
  showModActivity: true,
  showKarmaStats: true,
  showLeaderboard: false,
  showInactiveAlerts: true,
  inactiveThresholdDays: 5,
};
const lbBodyDisabled = formatReport(lbReport, settingsNoLeaderboard);
assertNotContains(lbBodyDisabled, 'Top Moderators (Leaderboard)', 'Leaderboard disabled: no leaderboard header');
assertContains(lbBodyDisabled, 'Top Moderators', 'Leaderboard disabled: simple mod list shown');

// Inactive alerts disabled
const settingsNoInactive: ModVitalsSettings = {
  reportFrequency: 'daily',
  reportHour: 12,
  showPosts: true,
  showComments: true,
  showRemovals: true,
  showApprovals: true,
  showRuleViolations: true,
  showTopOffenders: true,
  showModActivity: true,
  showKarmaStats: true,
  showLeaderboard: true,
  showInactiveAlerts: false,
  inactiveThresholdDays: 5,
};
const lbBodyNoInactive = formatReport(lbReport, settingsNoInactive);
assertNotContains(lbBodyNoInactive, '⚠️', 'Inactive disabled: no warning icon');
assertNotContains(lbBodyNoInactive, 'Inactive', 'Inactive disabled: no inactive text');

// All mods inactive with zero actions
function makeReportAllInactiveZero(): ReportData {
  const base = makeActiveReport();
  return {
    ...base,
    period: {
      ...base.period,
      topMods: [
        { username: 'mod1', count: 0 },
        { username: 'mod2', count: 0 },
      ],
      leaderboard: [
        { rank: 1, username: 'mod1', count: 0, pct: 0, isMostActive: false, lastActionTimestamp: new Date(Date.now() - 10 * 86400000).toISOString(), daysSinceLastAction: 10, isInactive: true },
        { rank: 2, username: 'mod2', count: 0, pct: 0, isMostActive: false, lastActionTimestamp: new Date(Date.now() - 15 * 86400000).toISOString(), daysSinceLastAction: 15, isInactive: true },
      ],
      topActionTypes: [],
    },
  };
}

const allInactiveReport = makeReportAllInactiveZero();
const allInactiveBody = formatReport(allInactiveReport);
assertContains(allInactiveBody, 'All moderators are currently inactive', 'All inactive: special message shown');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
