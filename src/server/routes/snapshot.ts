import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { generateReport, detectAnomalies, parseMetrics } from '../scheduler-logic.js';
import { formatReport, buildReportTitle } from '../report.js';
import { postReportToSubreddit } from '../posting.js';
import { getSettings } from '../settings.js';
import { getMultipleSnapshots } from '../metrics.js';
import { fetchUsersKarma, storeOffenderKarmaSnapshots } from '../karma.js';
import { getRelativeDateKey } from '../date-utils.js';
import { isFeatureEnabled } from '../feature-flags.js';

// ---------------------------------------------------------------------------
// Route registration — snapshot (on-demand menu action)
// ---------------------------------------------------------------------------

/**
 * Register the snapshot menu-action route on the given Hono app.
 *
 * The 'Generate Report Now' action appears in the subreddit overflow menu
 * (mod-only). When triggered, it immediately generates a current health
 * report WITHOUT waiting for the scheduled cron job.
 *
 * Key differences from the scheduler route:
 * - Bypasses hour/frequency checks and dedup guard — always generates
 * - Does NOT update lastReport timestamp (preserves production schedule)
 * - Does NOT store daily snapshot (avoids polluting anomaly baseline)
 * - Adds "[SNAPSHOT]" prefix to the report title
 * - Returns visible feedback (post URL via toast)
 */
export default function registerSnapshot(app: Hono): void {
  app.post('/internal/menu/generate-snapshot', async (c) => {
    const body = await c.req.json<MenuItemRequest>();
    const bodyAny = body as unknown as Record<string, unknown>;

    console.log('[snapshot:generate] invoked via menu action', {
      userId: bodyAny.userId,
      userName: bodyAny.userName,
      subreddit: bodyAny.subreddit,
    });

    try {
      // Load mod settings (for metric visibility toggles)
      const modSettings = await getSettings();

      console.log('[snapshot:generate] settings loaded', {
        reportFrequency: modSettings.reportFrequency,
      });

      // Generate report — skip timestamp update to preserve cron schedule
      const report = await generateReport(
        modSettings.inactiveThresholdDays,
        undefined, // no lastReportTimestampOverride
        true, // skipTimestampUpdate — critical: don't modify lastReport
      );

      console.log('[snapshot:generate] aggregation complete', {
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

      // Enrich repeat offenders — gated by flag + setting
      const karmaFlag = await isFeatureEnabled('enhancedKarma');
      if (karmaFlag && modSettings.showKarmaStats && report.period.topOffenders.length > 0) {
        const usernames = report.period.topOffenders.map((o) => o.username);
        const karmaMap = await fetchUsersKarma(usernames);

        for (const [username, info] of karmaMap) {
          report.period.offenderKarma[username] = info;
        }

        await storeOffenderKarmaSnapshots(report.period.dateKey, karmaMap);

        console.log('[snapshot:generate] karma enrichment complete', {
          usersFetched: usernames.length,
          successful: [...karmaMap.values()].filter((v) => v !== null).length,
        });
      }

      // NOTE: Do NOT store daily snapshot — avoids polluting anomaly baseline

      // Compute anomaly alerts — gated by flag + setting
      const anomalyFlag = await isFeatureEnabled('anomalyV2');
      if (anomalyFlag && modSettings.showAnomalyAlerts) {
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
        report.anomalyData = detectAnomalies(report.period.metrics, snapshotMetrics);

        console.log('[snapshot:generate] anomaly detection complete', {
          hasSufficientData: report.anomalyData.hasSufficientData,
          baselineDays: report.anomalyData.baselineDays,
          alertsCount: report.anomalyData.alerts.length,
          alerts: report.anomalyData.alerts.map((a) => `${a.label}(${a.percentOfAverage}%)`),
        });
      }

      // Format the report with [SNAPSHOT] prefix in the title
      const baseTitle = buildReportTitle(report);
      const title = `[SNAPSHOT] ${baseTitle}`;
      const bodyText = formatReport(report, modSettings);

      console.log('[snapshot:generate] report formatted', {
        title,
        bodyLength: bodyText.length,
      });

      // Submit the report as a mod-only self-post
      const { postId, url } = await postReportToSubreddit(title, bodyText);

      console.log('[snapshot:generate] completed successfully', {
        postId,
        url,
      });

      // Return visible feedback — the post URL shown to the mod
      return c.json<UiResponse>({
        showToast: `Snapshot report generated! ${url}`,
      });
    } catch (err) {
      console.error('[snapshot:generate] error', err);
      return c.json<UiResponse>({
        showToast: 'Failed to generate snapshot report. See logs for details.',
      });
    }
  });
}
