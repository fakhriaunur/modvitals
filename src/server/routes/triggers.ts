import { Hono } from 'hono';
import type {
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  OnModActionRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import {
  incrementPostCount,
  incrementCommentCount,
  incrementRemovalCount,
  incrementApprovalCount,
  trackModAction,
  incrementOffenderScore,
} from '../metrics.js';

// ---------------------------------------------------------------------------
// Pure business logic — independently callable
// ---------------------------------------------------------------------------

/**
 * Handle a post-submit trigger event.
 * Increments the daily post counter in Redis.
 */
export async function handlePostSubmit(body: OnPostSubmitRequest): Promise<void> {
  console.log('[trigger:post-submit] post submitted', {
    postId: body.post?.id,
    author: body.author?.name,
  });

  await incrementPostCount();
}

/**
 * Handle a comment-create trigger event.
 * Increments the daily comment counter in Redis.
 */
export async function handleCommentCreate(body: OnCommentCreateRequest): Promise<void> {
  console.log('[trigger:comment-create] comment created', {
    commentId: body.comment?.id,
    author: body.author?.name,
    postId: body.post?.id,
  });

  await incrementCommentCount();
}

// ---------------------------------------------------------------------------
// Action classification constants
// ---------------------------------------------------------------------------

const REMOVAL_ACTIONS = new Set([
  'removelink',
  'removecomment',
  'spamlink',
  'spamcomment',
] as const);

const APPROVAL_ACTIONS = new Set(['approvelink', 'approvecomment'] as const);

/**
 * Handle a mod-action trigger event.
 *
 * Captures:
 * - Removals → increments removal counter + tracks repeat offenders
 * - Approvals → increments approval counter
 * - All actions → tracks per-mod action counts in Redis hash
 */
export async function handleModAction(body: OnModActionRequest): Promise<void> {
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

  // Action-specific tracking using Sets (cast to Set<string> for string comparison)
  if ((REMOVAL_ACTIONS as Set<string>).has(action)) {
    await incrementRemovalCount();

    // Track repeat offenders when content is removed
    if (targetUser) {
      await incrementOffenderScore(targetUser);
    }
  } else if ((APPROVAL_ACTIONS as Set<string>).has(action)) {
    await incrementApprovalCount();
  }
  // Other actions (banuser, warnuser, muteuser, etc.) are tracked
  // via trackModAction above for per-mod stats but don't have
  // dedicated top-level counters yet.
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register all trigger event routes on the given Hono app.
 */
export default function registerTriggers(app: Hono): void {
  app.post('/internal/triggers/post-submit', async (c) => {
    const body = await c.req.json<OnPostSubmitRequest>();
    await handlePostSubmit(body);
    return c.json<TriggerResponse>({ status: 'ok' }, 200);
  });

  app.post('/internal/triggers/comment-create', async (c) => {
    const body = await c.req.json<OnCommentCreateRequest>();
    await handleCommentCreate(body);
    return c.json<TriggerResponse>({ status: 'ok' }, 200);
  });

  app.post('/internal/triggers/mod-action', async (c) => {
    const body = await c.req.json<OnModActionRequest>();
    await handleModAction(body);
    return c.json<TriggerResponse>({ status: 'ok' }, 200);
  });
}
