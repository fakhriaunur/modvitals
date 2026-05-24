import { redis } from '@devvit/web/server';

/**
 * Get today's date as YYYYMMDD string for use in Redis key naming.
 * Example: metrics:20260524
 */
export function getDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Get a date key for a date relative to the given date key.
 * Example: getRelativeDateKey('20260524', -1) returns '20260523'
 */
function getRelativeDateKey(dateKey: string, offsetDays: number): string {
  const year = parseInt(dateKey.substring(0, 4), 10);
  const month = parseInt(dateKey.substring(4, 6), 10) - 1;
  const day = parseInt(dateKey.substring(6, 8), 10);

  const date = new Date(Date.UTC(year, month, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
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

// ---------------------------------------------------------------------------
// Reading / Query helpers
// ---------------------------------------------------------------------------

/**
 * Get all metrics for a specific date.
 * Key: metrics:{dateKey}
 * Returns a Record of metric name string → value string (e.g. { posts: "5" }).
 * Returns empty Record if the key does not exist.
 */
export async function getMetricsForDate(dateKey: string): Promise<Record<string, string>> {
  try {
    return await redis.hGetAll(`metrics:${dateKey}`);
  } catch {
    return {};
  }
}

/**
 * Get today's metrics.
 */
export async function getTodayMetrics(): Promise<Record<string, string>> {
  return getMetricsForDate(getDateKey());
}

/**
 * Get the date key for the previous day relative to the given date key.
 * If no dateKey is provided, uses today's date.
 */
export function getPreviousDateKey(dateKey?: string): string {
  return getRelativeDateKey(dateKey ?? getDateKey(), -1);
}

/**
 * Get top offenders from the global offenders sorted set.
 * Key: offenders (sorted set)
 * Returns array of { member, score } sorted highest score first.
 * Returns empty array if the key does not exist.
 */
export async function getTopOffenders(limit: number = 10): Promise<{ member: string; score: number }[]> {
  try {
    return await redis.zRange('offenders', 0, limit - 1, { reverse: true, by: 'rank' });
  } catch {
    return [];
  }
}

/**
 * Get all mod action counts for a specific date.
 * Key: mods:{dateKey} (hash: modUsername → action count)
 * Returns empty Record if the key does not exist.
 */
export async function getModsForDate(dateKey: string): Promise<Record<string, string>> {
  try {
    return await redis.hGetAll(`mods:${dateKey}`);
  } catch {
    return {};
  }
}

/**
 * Get top moderators by action count for a specific date.
 * Returns array of { username, count } sorted descending by count.
 * Returns empty array if no data.
 */
export async function getTopMods(dateKey: string, limit: number = 10): Promise<{ username: string; count: number }[]> {
  const mods = await getModsForDate(dateKey);
  const entries = Object.entries(mods);
  if (entries.length === 0) return [];

  return entries
    .map(([username, countStr]) => ({ username, count: parseInt(countStr, 10) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get all rule violations for a specific date.
 * Key: rules:{dateKey} (hash: rule name → violation count)
 * Returns empty Record if the key does not exist.
 */
export async function getRulesForDate(dateKey: string): Promise<Record<string, string>> {
  try {
    return await redis.hGetAll(`rules:${dateKey}`);
  } catch {
    return {};
  }
}

/**
 * Get top rule violations by count for a specific date.
 * Returns array of { rule, count } sorted descending by count.
 * Returns empty array if no data.
 */
export async function getTopRules(dateKey: string, limit: number = 10): Promise<{ rule: string; count: number }[]> {
  const rules = await getRulesForDate(dateKey);
  const entries = Object.entries(rules);
  if (entries.length === 0) return [];

  return entries
    .map(([rule, countStr]) => ({ rule, count: parseInt(countStr, 10) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get top action types across all mods for a specific date.
 * Derives action types from modActions:{dateKey} hash which stores
 * keys like "modname:actionType" → count.
 * Returns array of { action, count } sorted descending.
 */
export async function getTopActionTypes(dateKey: string, limit: number = 10): Promise<{ action: string; count: number }[]> {
  try {
    const actions = await redis.hGetAll(`modActions:${dateKey}`);
    const entries = Object.entries(actions);
    if (entries.length === 0) return [];

    // Aggregate counts per action type
    const actionTotals = new Map<string, number>();
    for (const [key, countStr] of entries) {
      const colonIdx = key.indexOf(':');
      const actionType = colonIdx >= 0 ? key.substring(colonIdx + 1) : key;
      const count = parseInt(countStr, 10) || 0;
      actionTotals.set(actionType, (actionTotals.get(actionType) ?? 0) + count);
    }

    return [...actionTotals.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get the timestamp of the last report that was generated.
 * Key: lastReport (string - ISO timestamp)
 * Returns the ISO timestamp string, or undefined if no report has been generated.
 */
export async function getLastReportTimestamp(): Promise<string | undefined> {
  try {
    return await redis.get('lastReport') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Store the current timestamp as the last report generation time.
 * Key: lastReport (string - ISO timestamp)
 */
export async function updateLastReportTimestamp(): Promise<void> {
  await redis.set('lastReport', new Date().toISOString());
}
