import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { generateReport } from '../scheduler-logic.js';
import { formatReport, buildReportTitle } from '../report.js';
import { postReportToSubreddit } from '../posting.js';
import { getSettings, shouldGenerateReport } from '../settings.js';
import { wasReportGeneratedToday } from '../metrics.js';

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
      });

      // Check if a report should be generated based on frequency + hour settings
      if (!shouldGenerateReport(modSettings.reportFrequency, modSettings.reportHour)) {
        console.log('[scheduler:generate-report] skipping — settings (frequency/hour) not met');
        return c.json<TaskResponse>({ status: 'ok' }, 200);
      }

      // Dedup: don't generate multiple reports per day
      const alreadyGenerated = await wasReportGeneratedToday();
      if (alreadyGenerated) {
        console.log('[scheduler:generate-report] skipping — report already generated today');
        return c.json<TaskResponse>({ status: 'ok' }, 200);
      }

      const report = await generateReport();

      console.log('[scheduler:generate-report] aggregation complete', {
        dateKey: report.period.dateKey,
        posts: report.period.metrics.posts,
        comments: report.period.metrics.comments,
        removals: report.period.metrics.removals,
        approvals: report.period.metrics.approvals,
        topOffenders: report.period.topOffenders.length,
        topMods: report.period.topMods.length,
        previousPeriodExists: report.previousPeriod.exists,
      });

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
