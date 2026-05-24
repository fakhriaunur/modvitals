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
} from './metrics.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  topOffenders: { member: string; score: number }[];
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
function parseMetrics(record: Record<string, string>): PeriodMetrics {
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
function computeTrend(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
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
export async function generateReport(): Promise<ReportData> {
  const dateKey = getDateKey();
  const prevDateKey = getPreviousDateKey(dateKey);

  // Current period
  const currentRaw = await getMetricsForDate(dateKey);
  const currentMetrics = parseMetrics(currentRaw);

  const [topOffenders, topMods, topRules, topActionTypes] = await Promise.all([
    getTopOffenders(10),
    getTopMods(dateKey, 10),
    getTopRules(dateKey, 10),
    getTopActionTypes(dateKey, 10),
  ]);

  // Previous period
  const prevRaw = await getMetricsForDate(prevDateKey);
  const prevExists = Object.keys(prevRaw).length > 0;
  const prevMetrics = prevExists ? parseMetrics(prevRaw) : null;

  const [prevTopMods, prevTopRules] = prevExists
    ? await Promise.all([
        getTopMods(prevDateKey, 10),
        getTopRules(prevDateKey, 10),
      ])
    : [[], []];

  // Compute trends
  const trends: TrendData = {
    posts: computeTrend(currentMetrics.posts, prevMetrics?.posts ?? null),
    comments: computeTrend(currentMetrics.comments, prevMetrics?.comments ?? null),
    removals: computeTrend(currentMetrics.removals, prevMetrics?.removals ?? null),
    approvals: computeTrend(currentMetrics.approvals, prevMetrics?.approvals ?? null),
  };

  // Record this run
  await updateLastReportTimestamp();
  const lastReportTimestamp = await getLastReportTimestamp();

  const report: ReportData = {
    generatedAt: new Date().toISOString(),
    period: {
      dateKey,
      metrics: currentMetrics,
      topRules,
      topActionTypes,
      topMods,
      topOffenders,
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

  return report;
}
