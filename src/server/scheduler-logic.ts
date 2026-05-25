import {
  getDateKey,
  getMetricsForDate,
  getPreviousDateKey,
  getTopOffenders,
  getTopMods,
  getTopRules,
  getTopActionTypes,
  updateLastReportTimestamp,
  getLastReportTimestamp,
  getModsForDate,
  getAllModLastActionTimestamps,
} from './metrics.js';
import type { KarmaInfo } from './karma.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REPORT_TOP_N = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry on the mod leaderboard. */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  count: number;
  pct: number;
  isMostActive: boolean;
  /** ISO timestamp of last recorded action, or undefined if none */
  lastActionTimestamp?: string;
  /** Days since last action (based on report generation time) */
  daysSinceLastAction?: number;
  isInactive: boolean;
}

export interface PeriodMetrics {
  posts: number;
  comments: number;
  removals: number;
  approvals: number;
  reports: number;
}

export interface PeriodData {
  dateKey: string;
  metrics: PeriodMetrics;
  topRules: { rule: string; count: number }[];
  topActionTypes: { action: string; count: number }[];
  topMods: { username: string; count: number }[];
  topOffenders: { username: string; score: number }[];
  /** Per-offender karma data fetched via Reddit API. Maps username → KarmaInfo (or null if not found). */
  offenderKarma: Record<string, KarmaInfo | null>;
  /** Ranked leaderboard of top moderators by action count */
  leaderboard: LeaderboardEntry[];
}

export interface TrendData {
  posts: number | null;
  comments: number | null;
  removals: number | null;
  approvals: number | null;
}

export interface ReportData {
  generatedAt: string;
  period: PeriodData;
  previousPeriod: {
    exists: boolean;
    dateKey: string | null;
    metrics: PeriodMetrics | null;
    topRules: { rule: string; count: number }[];
    topMods: { username: string; count: number }[];
  };
  trends: TrendData;
  lastReportTimestamp: string | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a metrics hash record into typed PeriodMetrics.
 * All missing/non-numeric fields default to 0.
 */
export function parseMetrics(record: Record<string, string>): PeriodMetrics {
  return {
    posts: parseInt(record.posts ?? '0', 10) || 0,
    comments: parseInt(record.comments ?? '0', 10) || 0,
    removals: parseInt(record.removals ?? '0', 10) || 0,
    approvals: parseInt(record.approvals ?? '0', 10) || 0,
    reports: parseInt(record.reports ?? '0', 10) || 0,
  };
}

/**
 * Compute the difference between two values.
 * If previous is null or 0, returns null (no meaningful trend).
 * Otherwise returns the percentage change as a number.
 */
export function computeTrend(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Compute the top-N leaderboard from mod action data.
 * Pure function — no I/O.
 *
 * @param mods - Array of mod entries (username → count) from the current period
 * @param totalActions - Total actions across all mods (for percentage calculation)
 * @param lastActionTimestamps - Record of modUsername → ISO timestamp of last action ever
 * @param lastReportTimestamp - ISO timestamp of last report generation (period boundary)
 * @param inactiveThresholdDays - Days without action before a mod is flagged inactive
 * @param limit - Maximum entries on the leaderboard (default 5)
 * @returns Ranked leaderboard entries
 */
export function computeLeaderboard(
  mods: { username: string; count: number }[],
  totalActions: number,
  lastActionTimestamps: Record<string, string>,
  lastReportTimestamp: string | undefined,
  inactiveThresholdDays: number,
  limit: number = 5,
): LeaderboardEntry[] {
  if (mods.length === 0) return [];

  const now = new Date();
  const total = totalActions > 0 ? totalActions : 1; // avoid division by zero

  return mods.slice(0, limit).map((mod, idx) => {
    const pct = Math.round((mod.count / total) * 100);
    const isMostActive = idx === 0 && mod.count > 0;

    // Compute days since last action
    const lastTs = lastActionTimestamps[mod.username] ?? lastReportTimestamp;
    let daysSinceLastAction: number | undefined;
    let isInactive = false;

    if (lastTs) {
      const lastDate = new Date(lastTs);
      const diffMs = now.getTime() - lastDate.getTime();
      daysSinceLastAction = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      isInactive = daysSinceLastAction >= inactiveThresholdDays;
    } else {
      // No timestamp at all — mod has never taken an action
      isInactive = true;
    }

    return {
      rank: idx + 1,
      username: mod.username,
      count: mod.count,
      pct,
      isMostActive,
      lastActionTimestamp: lastTs ?? undefined,
      daysSinceLastAction,
      isInactive,
    };
  });
}

/**
 * Pure aggregation function that builds a ReportData from already-fetched data.
 * No I/O side effects - all data is passed in as parameters.
 * This is the testable core extracted from generateReport's I/O shell.
 */
export function aggregateReport(
  dateKey: string,
  currentMetrics: PeriodMetrics,
  prevMetrics: PeriodMetrics | null,
  prevDateKey: string | null,
  topOffenders: { username: string; score: number }[],
  topMods: { username: string; count: number }[],
  topRules: { rule: string; count: number }[],
  topActionTypes: { action: string; count: number }[],
  prevTopMods: { username: string; count: number }[],
  prevTopRules: { rule: string; count: number }[],
  lastReportTimestamp?: string,
  generatedAt?: string,
  offenderKarma?: Record<string, KarmaInfo | null>,
  leaderboard?: LeaderboardEntry[],
): ReportData {
  const prevExists = prevMetrics !== null;
  const trends: TrendData = {
    posts: computeTrend(currentMetrics.posts, prevMetrics?.posts ?? null),
    comments: computeTrend(currentMetrics.comments, prevMetrics?.comments ?? null),
    removals: computeTrend(currentMetrics.removals, prevMetrics?.removals ?? null),
    approvals: computeTrend(currentMetrics.approvals, prevMetrics?.approvals ?? null),
  };

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    period: {
      dateKey,
      metrics: currentMetrics,
      topRules,
      topActionTypes,
      topMods,
      topOffenders,
      offenderKarma: offenderKarma ?? {},
      leaderboard: leaderboard ?? [],
    },
    previousPeriod: {
      exists: prevExists,
      dateKey: prevExists ? prevDateKey : null,
      metrics: prevMetrics,
      topRules: prevTopRules,
      topMods: prevTopMods,
    },
    trends,
    lastReportTimestamp,
  };
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

/**
 * Generate the daily report by aggregating all metrics from the current period
 * and comparing with the previous period for trend data.
 *
 * Handles edge cases:
 * - No data (zeroed metrics, empty arrays)
 * - Missing previous period (trends set to null)
 * - Redis key not found (gracefully returns empty)
 *
 * Writes the generation timestamp to Redis via updateLastReportTimestamp().
 *
 * @returns All aggregated report data.
 */
export async function generateReport(
  inactiveThresholdDays?: number,
  lastReportTimestampOverride?: string,
): Promise<ReportData> {
  const dateKey = getDateKey();
  const prevDateKey = getPreviousDateKey(dateKey);

  // Current period
  const currentRaw = await getMetricsForDate(dateKey);
  const currentMetrics = parseMetrics(currentRaw);

  const [topOffenders, topMods, topRules, topActionTypes] = await Promise.all([
    getTopOffenders(REPORT_TOP_N),
    getTopMods(dateKey, REPORT_TOP_N),
    getTopRules(dateKey, REPORT_TOP_N),
    getTopActionTypes(dateKey, REPORT_TOP_N),
  ]);

  // Previous period
  const prevRaw = await getMetricsForDate(prevDateKey);
  const prevExists = Object.keys(prevRaw).length > 0;
  const prevMetrics = prevExists ? parseMetrics(prevRaw) : null;

  const [prevTopMods, prevTopRules] = prevExists
    ? await Promise.all([
        getTopMods(prevDateKey, REPORT_TOP_N),
        getTopRules(prevDateKey, REPORT_TOP_N),
      ])
    : [[], []];

  // Get mod data for leaderboard computation
  const modsData = await getModsForDate(dateKey);
  const modEntries = Object.entries(modsData).map(([username, countStr]) => ({
    username,
    count: parseInt(countStr, 10) || 0,
  }));

  // Sort by count descending for leaderboard
  modEntries.sort((a, b) => b.count - a.count);

  // Get last action timestamps for all known mods
  const lastActionTimestamps = await getAllModLastActionTimestamps();

  // Read last report timestamp BEFORE recording this run, so it reflects the
  // previous period boundary (used for inactivity detection).
  const previousReportTimestamp = await getLastReportTimestamp();
  const periodBoundary = lastReportTimestampOverride ?? previousReportTimestamp;

  // Record this run (updates timestamp to now)
  await updateLastReportTimestamp();
  const lastReportTimestamp = await getLastReportTimestamp();

  // Compute total actions for percentage calculation
  const totalModActions = modEntries.reduce((sum, m) => sum + m.count, 0);

  // Build leaderboard
  const threshold = inactiveThresholdDays ?? 5;
  const leaderboard = computeLeaderboard(
    modEntries,
    totalModActions,
    lastActionTimestamps,
    periodBoundary,
    threshold,
    5,
  );

  // Delegate to pure function
  return aggregateReport(
    dateKey,
    currentMetrics,
    prevMetrics,
    prevDateKey,
    topOffenders,
    topMods,
    topRules,
    topActionTypes,
    prevTopMods,
    prevTopRules,
    lastReportTimestamp,
    new Date().toISOString(),
    // karma data is injected live by the scheduler route
    undefined,
    leaderboard,
  );
}
