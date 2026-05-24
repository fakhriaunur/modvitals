import { Hono } from 'hono';
import type {
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  OnModActionRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { reddit, createServer, getServerPort } from '@devvit/web/server';
import { getRequestListener } from '@hono/node-server';
import {
  incrementPostCount,
  incrementCommentCount,
  incrementRemovalCount,
  incrementApprovalCount,
  trackModAction,
  incrementOffenderScore,
  wasReportGeneratedToday,
} from './metrics.js';
import { generateReport } from './scheduler.js';
import { formatReport, buildReportTitle } from './report.js';
import { getSettings, shouldGenerateReport } from './settings.js';

const app = new Hono();

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', app: 'mod-vitals', version: '0.1.0' });
});

/**
 * Trigger: onPostSubmit
 * Fires when a new post is submitted in the subreddit.
 * Increments the daily post counter in Redis.
 */
app.post('/internal/triggers/post-submit', async (c) => {
  const body = await c.req.json<OnPostSubmitRequest>();

  console.log('[trigger:post-submit] post submitted', {
    postId: body.post?.id,
    author: body.author?.name,
  });

  await incrementPostCount();

  return c.json<TriggerResponse>({ status: 'ok' }, 200);
});

/**
 * Trigger: onCommentCreate
 * Fires when a new comment is created in the subreddit.
 * Increments the daily comment counter in Redis.
 */
app.post('/internal/triggers/comment-create', async (c) => {
  const body = await c.req.json<OnCommentCreateRequest>();

  console.log('[trigger:comment-create] comment created', {
    commentId: body.comment?.id,
    author: body.author?.name,
    postId: body.post?.id,
  });

  await incrementCommentCount();

  return c.json<TriggerResponse>({ status: 'ok' }, 200);
});

/**
 * Trigger: onModAction
 * Fires when a moderator performs an action (remove, approve, warn, ban, etc.).
 * Captures:
 * - Removals → increments removal counter + tracks repeat offenders
 * - Approvals → increments approval counter
 * - All actions → tracks per-mod action counts in Redis hash
 */
app.post('/internal/triggers/mod-action', async (c) => {
  const body = await c.req.json<OnModActionRequest>();

  const action = body.action ?? '';
  const moderator = body.moderator?.name ?? 'unknown';
  const targetUser = body.targetUser?.name;
  const targetPostId = body.targetPost?.id;
  const targetCommentId = body.targetComment?.id;

  console.log('[trigger:mod-action] mod action', {
    action,
    moderator,
    targetUser,
    targetPostId,
    targetCommentId,
  });

  // Track per-mod action count (all actions)
  await trackModAction(moderator, action);

  // Action-specific tracking
  if (
    action === 'removelink' ||
    action === 'removecomment' ||
    action === 'spamlink' ||
    action === 'spamcomment'
  ) {
    await incrementRemovalCount();

    // Track repeat offenders when content is removed
    if (targetUser) {
      await incrementOffenderScore(targetUser);
    }
  } else if (
    action === 'approvelink' ||
    action === 'approvecomment'
  ) {
    await incrementApprovalCount();
  }
  // Other actions (banuser, warnuser, muteuser, etc.) are tracked
  // via trackModAction above for per-mod stats but don't have
  // dedicated top-level counters yet.

  return c.json<TriggerResponse>({ status: 'ok' }, 200);
});

/**
 * Settings validation: report-hour
 * Validates that the report hour is between 0 and 23.
 * Devvit calls this endpoint when the mod saves the setting.
 */
app.post('/internal/settings/validate-hour', async (c) => {
  const body = await c.req.json<{ value: number }>();
  const hour = body.value;

  console.log('[settings:validate-hour] validating', { hour });

  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return c.json(
      { error: 'Report hour must be an integer between 0 and 23.' },
      400,
    );
  }

  return c.json({ status: 'ok' }, 200);
});

/**
 * Scheduler: generate-report
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

    // Submit the report as a self-post to the current subreddit
    // Use the reddit client singleton to post with mod scope
    const post = await reddit.submitPost({
      title,
      text: bodyText,
    });

    console.log('[scheduler:generate-report] post submitted', {
      postId: post.id,
      postTitle: post.title,
    });

    // Make the post mod-only visibility:
    // 1. Distinguish as a moderator post (green [M] shield, visible in mod discussions)
    // 2. Approve the post (marks as reviewed by mod team)
    try {
      await post.distinguish();
      await post.approve();
      console.log('[scheduler:generate-report] post marked as distinguished mod post');
    } catch (modErr) {
      // Non-blocking: post was submitted even if mod-only flags fail
      console.warn('[scheduler:generate-report] could not set mod-only flags', modErr);
    }

    console.log('[scheduler:generate-report] completed successfully', {
      postId: post.id,
    });

    return c.json<TaskResponse>({ status: 'ok' }, 200);
  } catch (err) {
    console.error('[scheduler:generate-report] error', err);
    // Return ok even on error — scheduler will retry
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  }
});

// Create and start the HTTP server using Devvit's context-wrapping createServer
// bridged through @hono/node-server's getRequestListener for Web Fetch API compat
const port = getServerPort();
const requestListener = getRequestListener(app.fetch);
const server = createServer(requestListener);
server.listen(port, () => {
  console.log(`[modvitals] server listening on port ${port}`);
});

export default app;
