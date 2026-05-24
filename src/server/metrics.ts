import { redis } from '@devvit/web/server';

/**
 * Get today's date as YYYYMMDD string for use in Redis key naming.
 * Example: metrics:20260524
 */
function getDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Increment a numeric field in the daily metrics hash.
 * Key: metrics:{YYYYMMDD}
 * Field: the metric name (e.g., 'posts', 'comments', 'removals')
 */
async function incrementCounter(field: string, count: number = 1): Promise<void> {
  const key = `metrics:${getDateKey()}`;
  await redis.hIncrBy(key, field, count);
}

/**
 * Increment the post submission counter for today.
 */
export async function incrementPostCount(): Promise<void> {
  await incrementCounter('posts');
}

/**
 * Increment the comment creation counter for today.
 */
export async function incrementCommentCount(): Promise<void> {
  await incrementCounter('comments');
}

/**
 * Increment the removal counter for today (post or comment removal).
 */
export async function incrementRemovalCount(): Promise<void> {
  await incrementCounter('removals');
}

/**
 * Increment the approval counter for today (post or comment approval).
 */
export async function incrementApprovalCount(): Promise<void> {
  await incrementCounter('approvals');
}

/**
 * Track a moderator action in the daily mod actions hash.
 * Key: modActions:{YYYYMMDD}
 * Field: moderator username
 * Value: incremented action count for that mod
 */
export async function trackModAction(modUsername: string, actionType: string): Promise<void> {
  const modKey = `mods:${getDateKey()}`;
  await redis.hIncrBy(modKey, modUsername, 1);

  // Track per-mod action-type breakdown
  const actionKey = `modActions:${getDateKey()}`;
  await redis.hIncrBy(actionKey, `${modUsername}:${actionType}`, 1);
}

/**
 * Increment a user's offender score in the global offenders sorted set.
 * Used for tracking repeat offenders whose content gets removed.
 * Key: offenders (sorted set)
 * Member: username
 * Score: incremented by amount each call
 */
export async function incrementOffenderScore(username: string, amount: number = 1): Promise<void> {
  await redis.zIncrBy('offenders', username, amount);
}
