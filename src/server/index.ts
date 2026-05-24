import { Hono } from 'hono';
import type {
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  OnModActionRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import {
  incrementPostCount,
  incrementCommentCount,
  incrementRemovalCount,
  incrementApprovalCount,
  trackModAction,
  incrementOffenderScore,
} from './metrics.js';

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
 * Scheduler: generate-report
 * Called by the cron scheduler to generate the daily health report.
 * Stub implementation — will be fully implemented in the next milestone.
 */
app.post('/internal/scheduler/generate-report', async (c) => {
  const body = await c.req.json<TaskRequest>();

  console.log('[scheduler:generate-report] invoked', {
    name: body.name,
  });

  return c.json<TaskResponse>({ status: 'ok' }, 200);
});

export default app;
