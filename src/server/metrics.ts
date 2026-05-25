import { redis } from '@devvit/web/server';
import { getTodayDateKey, getRelativeDateKey } from './date-utils.js';

// ---------------------------------------------------------------------------
// Redis key constants
// ---------------------------------------------------------------------------

const KEY = {
  metrics: (dateKey: string) => `metrics:${dateKey}`,
  mods: (dateKey: string) => `mods:${dateKey}`,
  modActions: (dateKey: string) => `modActions:${dateKey}`,
  rules: (dateKey: string) => `rules:${dateKey}`,
  offenders: 'offenders',
  lastReport: 'lastReport',
  karma: (dateKey: string) => `karma:${dateKey}`,
} as const;

// ---------------------------------------------------------------------------
// Date helpers (delegated to date-utils)
// ---------------------------------------------------------------------------

/**
 * Get today's date as YYYYMMDD string for use in Redis key naming.
 */
export function getDateKey(): string {
  return getTodayDateKey();
}

/**
 * Increment a numeric field in the daily metrics hash.
 * Key: metrics:{YYYYMMDD}
 * Field: the metric name (e.g., 'posts', 'comments', 'removals')
 */
async function incrementCounter(field: string, count: number = 1): Promise<void> {
  const key = KEY.metrics(getDateKey());
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
  const modKey = KEY.mods(getDateKey());
  await redis.hIncrBy(modKey, modUsername, 1);

  // Track per-mod action-type breakdown
  const actionKey = KEY.modActions(getDateKey());
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
  await redis.zIncrBy(KEY.offenders, username, amount);
}

// ---------------------------------------------------------------------------
// Generic sort-and-slice helper
// ---------------------------------------------------------------------------

/**
 * Sort entries from a Redis hash by count (descending) and return top N.
 * Generic helper that replaces repeated sort-and-slice patterns.
 */
function topFromHash<T>(
  hashData: Record<string, string>,
  mapFn: (key: string, count: number) => T,
  sortKeyFn: (item: T) => number,
  limit: number = 10,
): T[] {
  const entries = Object.entries(hashData);
  if (entries.length === 0) return [];
  return entries
    .map(([key, countStr]) => mapFn(key, parseInt(countStr, 10) || 0))
    .sort((a, b) => sortKeyFn(b) - sortKeyFn(a))
    .slice(0, limit);
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
    return await redis.hGetAll(KEY.metrics(dateKey));
  } catch (error) {
    console.error('[metrics] failed to getMetricsForDate', { dateKey, error });
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
 * Returns array of { username, score } sorted highest score first.
 * Returns empty array if the key does not exist.
 */
export async function getTopOffenders(limit: number = 10): Promise<{ username: string; score: number }[]> {
  try {
    const results = await redis.zRange(KEY.offenders, 0, limit - 1, { reverse: true, by: 'rank' });
    return results.map((r) => ({ username: r.member, score: r.score }));
  } catch (error) {
    console.error('[metrics] failed to getTopOffenders', { limit, error });
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
    return await redis.hGetAll(KEY.mods(dateKey));
  } catch (error) {
    console.error('[metrics] failed to getModsForDate', { dateKey, error });
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
  return topFromHash(
    mods,
    (username, count) => ({ username, count }),
    (item) => item.count,
    limit,
  );
}

/**
 * Get all rule violations for a specific date.
 * Key: rules:{dateKey} (hash: rule name → violation count)
 * Returns empty Record if the key does not exist.
 */
export async function getRulesForDate(dateKey: string): Promise<Record<string, string>> {
  try {
    return await redis.hGetAll(KEY.rules(dateKey));
  } catch (error) {
    console.error('[metrics] failed to getRulesForDate', { dateKey, error });
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
  return topFromHash(
    rules,
    (rule, count) => ({ rule, count }),
    (item) => item.count,
    limit,
  );
}

/**
 * Get top action types across all mods for a specific date.
 * Derives action types from modActions:{dateKey} hash which stores
 * keys like "modname:actionType" → count.
 * Returns array of { action, count } sorted descending.
 */
export async function getTopActionTypes(dateKey: string, limit: number = 10): Promise<{ action: string; count: number }[]> {
  try {
    const actions = await redis.hGetAll(KEY.modActions(dateKey));
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
  } catch (error) {
    console.error('[metrics] failed to getTopActionTypes', { dateKey, limit, error });
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
    return await redis.get(KEY.lastReport) ?? undefined;
  } catch (error) {
    console.error('[metrics] failed to getLastReportTimestamp', { error });
    return undefined;
  }
}

/**
 * Check if a report has already been generated today (same UTC date).
 */
export async function wasReportGeneratedToday(): Promise<boolean> {
  const lastTs = await getLastReportTimestamp();
  if (!lastTs) return false;
  const lastDate = lastTs.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return lastDate === today;
}

/**
 * Store the current timestamp as the last report generation time.
 * Key: lastReport (string - ISO timestamp)
 */
export async function updateLastReportTimestamp(): Promise<void> {
  await redis.set(KEY.lastReport, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Karma snapshot helpers
// ---------------------------------------------------------------------------

/**
 * Store a karma snapshot for a user in the karma:{dateKey} hash.
 * Value stored as "linkKarma|commentKarma" pipe-delimited string.
 */
export async function storeKarmaSnapshot(
  dateKey: string,
  username: string,
  linkKarma: number,
  commentKarma: number,
): Promise<void> {
  try {
    await redis.hSet(KEY.karma(dateKey), username, `${linkKarma}|${commentKarma}`);
  } catch (error) {
    console.error('[metrics] failed to storeKarmaSnapshot', { dateKey, username, error });
  }
}

/**
 * Get all karma snapshots for a specific date.
 * Key: karma:{dateKey} (hash: username → "linkKarma|commentKarma")
 * Returns a Record of username → { linkKarma, commentKarma }.
 * Returns empty Record if the key does not exist.
 */
export async function getKarmaSnapshotsForDate(
  dateKey: string,
): Promise<Record<string, { linkKarma: number; commentKarma: number }>> {
  try {
    const raw = await redis.hGetAll(KEY.karma(dateKey));
    const result: Record<string, { linkKarma: number; commentKarma: number }> = {};
    for (const [username, value] of Object.entries(raw)) {
      const parts = value.split('|');
      result[username] = {
        linkKarma: parseInt(parts[0] ?? '0', 10) || 0,
        commentKarma: parseInt(parts[1] ?? '0', 10) || 0,
      };
    }
    return result;
  } catch (error) {
    console.error('[metrics] failed to getKarmaSnapshotsForDate', { dateKey, error });
    return {};
  }
}
