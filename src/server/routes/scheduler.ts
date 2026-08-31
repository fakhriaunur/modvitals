import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { generateReport, detectAnomalies, parseMetrics } from '../scheduler-logic.js';
import { formatReport, buildReportTitle } from '../report.js';
import { postReportToSubreddit } from '../posting.js';
import { getSettings, shouldGenerateReport } from '../settings.js';
import {
  wasReportGeneratedToday,
  getLastReportTimestamp,
  storeDailySnapshot,
  getMultipleSnapshots,
} from '../metrics.js';
import { fetchUsersKarma, storeOffenderKarmaSnapshots } from '../karma.js';
import { getRelativeDateKey } from '../date-utils.js';
import { isFeatureEnabled } from '../feature-flags.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register the generate-report scheduler task route on the given Hono app.
 *
 * Called by the cron scheduler to generate the daily health report.
 * Reads current period metrics from Redis, compares with previous period
 * for trends, aggregates all data (totals, top rules, top offenders, top mods),
 * formats the report as a readable Markdown post, and submits it to the
 * subreddit with mod-only visibility (distinguished + approved).
 *
 * Respects the following mod-configurable settings:
 * - reportFrequency: controls whether a report is generated (weekly skips non-Monday)
 * - showPosts / showComments / etc.: controls which metrics appear in the report
 *
 * Stores the last report timestamp in Redis on success.
 */
export default function registerScheduler(app: Hono): void {
  app.post('/internal/scheduler/generate-report', async (c) => {
    const body = await c.req.json<TaskRequest>();

    console.log('[scheduler:generate-report] invoked', {
      name: body.name,
    });

    try {
      // Load mod settings to determine if and how to generate the report
      const modSettings = await getSettings();

      console.log('[scheduler:generate-report] settings loaded', {
        reportFrequency: modSettings.reportFrequency,
        reportHour: modSettings.reportHour,
        reportMinute: modSettings.reportMinute,
        timezoneOffset: modSettings.timezoneOffset,
        hasCustomCron: !!modSettings.customCron,
      });

      // Check if a report should be generated based on frequency + time settings
      const shouldRun = shouldGenerateReport(
        modSettings.reportFrequency,
        modSettings.reportHour,
        modSettings.reportMinute,
        modSettings.customCron,
        modSettings.timezoneOffset,
      );
      if (!shouldRun) {
        console.log('[scheduler:generate-report] skipping — settings (frequency/time) not met');
        return c.json<TaskResponse>({ status: 'ok' }, 200);
      }

      // Dedup: skip "already generated today" check for sub-hourly presets
      // (hourly, 4-hourly, 12-hourly, custom can all fire multiple times per day).
      // For daily/weekly, apply the dedup to prevent double-fires within the same window.
      const isSubHourly = ['hourly', '4-hourly', '12-hourly', 'custom'].includes(
        modSettings.reportFrequency,
      );
      if (!isSubHourly) {
        const alreadyGenerated = await wasReportGeneratedToday();
        if (alreadyGenerated) {
          console.log('[scheduler:generate-report] skipping — report already generated today');
          return c.json<TaskResponse>({ status: 'ok' }, 200);
        }
      } else {
        // For sub-hourly presets, dedup only if last report was within last 60s
        const lastReport = await getLastReportTimestamp();
        if (lastReport) {
          const elapsed = Date.now() - new Date(lastReport).getTime();
          if (elapsed < 60_000) {
            console.log('[scheduler:generate-report] skipping — last report <60s ago');
            return c.json<TaskResponse>({ status: 'ok' }, 200);
          }
        }
      }

      const report = await generateReport(modSettings.inactiveThresholdDays);

      console.log('[scheduler:generate-report] aggregation complete', {
        dateKey: report.period.dateKey,
        posts: report.period.metrics.posts,
        comments: report.period.metrics.comments,
        removals: report.period.metrics.removals,
        approvals: report.period.metrics.approvals,
        topOffenders: report.period.topOffenders.length,
        topMods: report.period.topMods.length,
        leaderboardSize: report.period.leaderboard.length,
        previousPeriodExists: report.previousPeriod.exists,
      });

      // Enrich repeat offenders with karma data — gated by feature flag + setting
      // Flag system: LaunchDarkly/Statsig/Unleash/GrowthBook parity via custom flags
      const karmaFlag = await isFeatureEnabled('enhancedKarma');
      if (karmaFlag && modSettings.showKarmaStats && report.period.topOffenders.length > 0) {
        const usernames = report.period.topOffenders.map((o) => o.username);
        const karmaMap = await fetchUsersKarma(usernames);

        // Attach karma data to the report
        for (const [username, info] of karmaMap) {
          report.period.offenderKarma[username] = info;
        }

        // Store karma snapshots in Redis for period-over-period delta comparison
        await storeOffenderKarmaSnapshots(report.period.dateKey, karmaMap);

        console.log('[scheduler:generate-report] karma enrichment complete', {
          usersFetched: usernames.length,
          successful: [...karmaMap.values()].filter((v) => v !== null).length,
        });
      }

      // Store daily snapshot for rolling average computation (anomaly detection)
      const currentMetrics = report.period.metrics;
      await storeDailySnapshot(report.period.dateKey, currentMetrics);

      // Compute anomaly alerts from 7-day rolling average — gated by flag + setting
      // Gradual rollout via anomalyV2Rollout (0-100) for safe rollout
      const anomalyFlag = await isFeatureEnabled('anomalyV2');
      const anomalyRollout = await isFeatureEnabled('anomalyV2Rollout');
      if (anomalyFlag && anomalyRollout && modSettings.showAnomalyAlerts) {
        // Generate date keys for the previous 7 days (excluding today)
        const dateKeys: string[] = [];
        for (let i = 1; i <= 7; i++) {
          dateKeys.push(getRelativeDateKey(report.period.dateKey, -i));
        }

        // Fetch snapshots from Redis in parallel
        const snapshots = await getMultipleSnapshots(dateKeys);

        // Parse snapshots into typed PeriodMetrics (skip empty/missing days)
        const snapshotMetrics = dateKeys
          .map((dk) => snapshots[dk])
          .filter((raw): raw is Record<string, string> => !!raw && Object.keys(raw).length > 0)
          .map((raw) => parseMetrics(raw));

        // Detect anomalies
        report.anomalyData = detectAnomalies(currentMetrics, snapshotMetrics);

        console.log('[scheduler:generate-report] anomaly detection complete', {
          hasSufficientData: report.anomalyData.hasSufficientData,
          baselineDays: report.anomalyData.baselineDays,
          alertsCount: report.anomalyData.alerts.length,
          alerts: report.anomalyData.alerts.map((a) => `${a.label}(${a.percentOfAverage}%)`),
        });
      }

      // Format the report into a Markdown post, respecting metric visibility settings
      const title = buildReportTitle(report);
      const bodyText = formatReport(report, modSettings);

      console.log('[scheduler:generate-report] report formatted', {
        title,
        bodyLength: bodyText.length,
      });

      // Submit the report as a mod-only self-post to the current subreddit
      const { postId, url } = await postReportToSubreddit(title, bodyText);

      console.log('[scheduler:generate-report] completed successfully', {
        postId,
        url,
      });

      return c.json<TaskResponse>({ status: 'ok' }, 200);
    } catch (err) {
      console.error('[scheduler:generate-report] error', err);
      // Return ok even on error — scheduler will retry
      return c.json<TaskResponse>({ status: 'ok' }, 200);
    }
  });
}
