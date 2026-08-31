import { test, expect } from '@playwright/test';
import { formatReport, buildReportTitle } from '../src/server/report.js';
import {
  aggregateReport,
  parseMetrics,
  computeLeaderboard,
  detectAnomalies,
} from '../src/server/scheduler-logic.js';
import type { ModVitalsSettings } from '../src/server/settings.js';
import type { PeriodMetrics } from '../src/server/scheduler-logic.js';

/**
 * Integration tests for report generation flow
 *
 * Validates the end-to-end flow from metrics aggregation through
 * report formatting, ensuring that scheduler-logic and report
 * modules interoperate correctly. These tests exercise the
 * integration between multiple pure modules that are normally
 * wired together in the scheduler route.
 */

const baseSettings: ModVitalsSettings = {
  reportFrequency: 'daily',
  reportHour: 12,
  reportMinute: 0,
  customCron: '0 12 * * *',
  timezoneOffset: 0,
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
  showAnomalyAlerts: true,
  showDebugInfo: false,
};

function makeMetrics(overrides: Partial<PeriodMetrics> = {}): PeriodMetrics {
  return {
    posts: 0,
    comments: 0,
    removals: 0,
    approvals: 0,
    reports: 0,
    ...overrides,
  };
}

test.describe('Report Generation Integration', () => {
  test('aggregateReport produces valid ReportData from empty metrics', async () => {
    const report = aggregateReport(
      '20260524',
      makeMetrics(),
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

    expect(report.period.metrics).toBeDefined();
    expect(report.generatedAt).toContain('2026-05-24');
    expect(report.trends).toBeDefined();
    expect(report.previousPeriod.exists).toBe(false);
  });

  test('aggregateReport with active metrics produces trend data', async () => {
    const current = makeMetrics({ posts: 15, comments: 42, removals: 8, approvals: 5, reports: 3 });
    const previous = makeMetrics({ posts: 10, comments: 30, removals: 5, approvals: 3, reports: 1 });

    const report = aggregateReport(
      '20260524',
      current,
      previous,
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

    expect(report.trends.posts).toBe(50);
    expect(report.trends.removals).toBe(60);
    expect(report.period.topRules.length).toBeGreaterThan(0);
    expect(report.period.topOffenders[0].username).toBe('offender1');
  });

  test('formatReport integrates with generated ReportData', async () => {
    const report = aggregateReport(
      '20260524',
      makeMetrics({ posts: 10, comments: 20, removals: 5, approvals: 3 }),
      makeMetrics({ posts: 5, comments: 10, removals: 2, approvals: 1 }),
      '20260523',
      [{ username: 'user1', score: 2 }],
      [{ username: 'mod1', count: 5 }],
      [{ rule: 'Rule A', count: 3 }],
      [{ action: 'removelink', count: 3 }],
      [],
      [],
      undefined,
      '2026-05-24T12:00:00.000Z',
      { user1: { linkKarma: 100, commentKarma: 50, accountCreatedAt: new Date('2023-01-01'), subredditKarma: { fromComments: 10, fromPosts: 5 } } },
    );

    const title = buildReportTitle(report);
    const body = formatReport(report, baseSettings);

    expect(title).toContain('May 24, 2026');
    expect(body).toContain('### Overview');
    expect(body).toContain('### Activity Summary');
  });

  test('formatReport respects settings toggles end-to-end', async () => {
    const report = aggregateReport(
      '20260524',
      makeMetrics({ posts: 10, comments: 20, removals: 5, approvals: 3 }),
      null,
      null,
      [{ username: 'offender1', score: 3 }],
      [],
      [{ rule: 'No Spam', count: 5 }],
      [],
      [],
      [],
      undefined,
      '2026-05-24T12:00:00.000Z',
    );

    const settingsNoOffenders: ModVitalsSettings = { ...baseSettings, showTopOffenders: false };
    const body = formatReport(report, settingsNoOffenders);
    expect(body).not.toContain('### Repeat Offenders');

    const settingsNoRules: ModVitalsSettings = { ...baseSettings, showRuleViolations: false };
    const body2 = formatReport(report, settingsNoRules);
    expect(body2).not.toContain('### Rule Violations');
  });

  test('full pipeline: metrics -> report -> markdown -> contains expected sections', async () => {
    const current = makeMetrics({ posts: 20, comments: 40, removals: 10, approvals: 5, reports: 2 });
    const previous = makeMetrics({ posts: 10, comments: 20, removals: 5, approvals: 2, reports: 1 });

    const sevenSnapshots: PeriodMetrics[] = Array.from({ length: 7 }, () => makeMetrics({ posts: 5, comments: 10, removals: 3, approvals: 2, reports: 1 }));
    const anomalyData = detectAnomalies(current, sevenSnapshots);

    const report = aggregateReport(
      '20260524',
      current,
      previous,
      '20260523',
      [
        { username: 'baduser1', score: 5 },
        { username: 'baduser2', score: 3 },
      ],
      [
        { username: 'mod1', count: 10 },
        { username: 'mod2', count: 5 },
      ],
      [
        { rule: 'Spam', count: 4 },
        { rule: 'Harassment', count: 2 },
      ],
      [{ action: 'removelink', count: 6 }],
      [],
      [],
      undefined,
      '2026-05-24T12:00:00.000Z',
      {},
      [],
      anomalyData,
    );

    const body = formatReport(report, baseSettings);

    expect(body).toContain('⚠️ Anomaly Alerts');
    expect(body).toContain('u/baduser1');
    expect(body).toContain('Spam');
  });
});

test.describe('Scheduler Logic Integration', () => {
  test('leaderboard integration with mod activity', async () => {
    const mods = [
      { username: 'mod1', count: 10 },
      { username: 'mod2', count: 5 },
      { username: 'mod3', count: 2 },
    ];
    const total = 17;
    const timestamps = {
      mod1: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      mod2: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      mod3: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    };

    const leaderboard = computeLeaderboard(mods, total, timestamps, undefined, 5, 5);
    expect(leaderboard.length).toBe(3);
    expect(leaderboard[0].username).toBe('mod1');
    expect(leaderboard[0].isMostActive).toBe(true);
    expect(leaderboard[2].isInactive).toBe(true);
  });

  test('parseMetrics integrates with aggregateReport', async () => {
    const rawCurrent = { posts: '15', comments: '42', removals: '8', approvals: '5', reports: '3' };
    const rawPrev = { posts: '10', comments: '30', removals: '5', approvals: '3', reports: '1' };
    const current = parseMetrics(rawCurrent);
    const previous = parseMetrics(rawPrev);

    const report = aggregateReport(
      '20260524',
      current,
      previous,
      '20260523',
      [],
      [],
      [],
      [],
      [],
      [],
      undefined,
      '2026-05-24T12:00:00.000Z',
    );

    expect(report.period.metrics.posts).toBe(15);
    expect(report.trends.posts).toBe(50);
  });
});
