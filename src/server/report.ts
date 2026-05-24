import type { ReportData, TrendData } from './scheduler.js';
import type { ModVitalsSettings } from './settings.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostReportResult {
  success: boolean;
  postId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Trend arrow: ▲ for increase, ▼ for decrease, ➡ for no change, ― for no data.
 */
function trendArrow(trend: number | null): string {
  if (trend === null) return '―';
  if (trend > 0) return '▲';
  if (trend < 0) return '▼';
  return '➡';
}

/**
 * Format a numeric value with a trend indicator.
 * trend is a percentage change (e.g. 15 means 15% increase).
 */
function formatWithTrend(value: number, trend: number | null): string {
  const arrow = trendArrow(trend);
  if (trend === null) {
    return `${value}`;
  }
  const absPct = Math.abs(trend);
  return `${value} ${arrow} (${absPct}% ${trend >= 0 ? 'up' : 'down'})`;
}

/**
 * Format a percentage value.
 */
function formatPct(value: number): string {
  return `${value}%`;
}

/**
 * Format a list of items as a bulleted markdown list.
 */
function formatBulletList<T>(
  items: T[],
  labelFn: (item: T, index: number) => string,
  emptyLabel: string = 'None',
  maxItems: number = 10,
): string {
  if (items.length === 0) return `- ${emptyLabel}`;
  return items
    .slice(0, maxItems)
    .map((item, i) => `- ${labelFn(item, i)}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Section formatters
// ---------------------------------------------------------------------------

/**
 * Format the Overview section.
 */
function formatOverview(report: ReportData): string {
  const { metrics } = report.period;
  const { trends } = report;

  const lines: string[] = ['### Overview\n'];

  const totalActions =
    metrics.removals + metrics.approvals + metrics.posts + metrics.comments;

  if (totalActions === 0 && report.period.topRules.length === 0 && report.period.topOffenders.length === 0) {
    lines.push('No activity in this period.\n');
    return lines.join('\n');
  }

  lines.push(`- **Total Reports:** ${formatWithTrend(metrics.reports, trends.posts !== null ? null : null)}`);
  lines.push(`- **Removals:** ${formatWithTrend(metrics.removals, trends.removals)}`);
  lines.push(`- **Approvals:** ${formatWithTrend(metrics.approvals, trends.approvals)}`);
  lines.push(`- **Posts:** ${formatWithTrend(metrics.posts, trends.posts)}`);
  lines.push(`- **Comments:** ${formatWithTrend(metrics.comments, trends.comments)}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the Activity Summary section.
 * Respects metric visibility settings: showPosts, showComments, showRemovals, showApprovals.
 */
function formatActivitySummary(report: ReportData, settings?: ModVitalsSettings): string {
  const { metrics } = report.period;
  const { trends } = report;

  const lines: string[] = ['### Activity Summary\n'];

  const hasPostActivity = !settings || settings.showPosts || settings.showComments;
  const hasModActivity = !settings || settings.showRemovals || settings.showApprovals;

  if (!hasPostActivity && !hasModActivity) {
    lines.push('Activity metrics are disabled in settings.\n');
    return lines.join('\n');
  }

  const totalItems = (settings?.showPosts !== false ? metrics.posts : 0)
    + (settings?.showComments !== false ? metrics.comments : 0);
  const totalModActions = (settings?.showRemovals !== false ? metrics.removals : 0)
    + (settings?.showApprovals !== false ? metrics.approvals : 0);

  if (totalItems === 0 && totalModActions === 0) {
    lines.push('No user or moderator activity recorded.\n');
    return lines.join('\n');
  }

  if (hasPostActivity) {
    if (totalItems > 0) {
      const visibleRemovals = settings?.showRemovals !== false ? metrics.removals : 0;
      const removalRate = totalItems > 0 ? Math.round((visibleRemovals / totalItems) * 100) : 0;
      const visibleApprovals = settings?.showApprovals !== false ? metrics.approvals : 0;
      const approvalRate = totalItems > 0 ? Math.round((visibleApprovals / totalItems) * 100) : 0;

      lines.push(`- **Total submissions:** ${totalItems}`);
      if (settings?.showRemovals !== false) {
        lines.push(`- **Removal rate:** ${formatPct(removalRate)}`);
      }
      if (settings?.showApprovals !== false) {
        lines.push(`- **Approval rate:** ${formatPct(approvalRate)}`);
      }
    } else {
      lines.push('- **Total submissions:** 0');
    }
  }

  if (hasModActivity) {
    lines.push(`- **Total mod actions:** ${totalModActions}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format the Rule Violations section.
 */
function formatRuleViolations(report: ReportData): string {
  const { topRules } = report.period;

  const lines: string[] = ['### Rule Violations\n'];

  if (topRules.length === 0) {
    lines.push('No rule violations recorded.\n');
    return lines.join('\n');
  }

  lines.push(
    formatBulletList(
      topRules,
      (r) => `**${r.rule}** — ${r.count} violation${r.count !== 1 ? 's' : ''}`,
      'No rule violations recorded.',
    ),
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the Repeat Offenders section.
 */
function formatRepeatOffenders(report: ReportData): string {
  const { topOffenders } = report.period;

  const lines: string[] = ['### Repeat Offenders\n'];

  if (topOffenders.length === 0) {
    lines.push('No repeat offenders.\n');
    return lines.join('\n');
  }

  lines.push(
    formatBulletList(
      topOffenders,
      (o) => `**u/${o.member}** — ${o.score} incident${o.score !== 1 ? 's' : ''}`,
      'No repeat offenders.',
    ),
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the Mod Activity section.
 */
function formatModActivity(report: ReportData): string {
  const { topMods } = report.period;
  const { topActionTypes } = report.period;

  const lines: string[] = ['### Mod Activity\n'];

  if (topMods.length === 0 && topActionTypes.length === 0) {
    lines.push('No moderator activity recorded.\n');
    return lines.join('\n');
  }

  if (topMods.length > 0) {
    lines.push('**Top Moderators:**\n');
    lines.push(
      formatBulletList(
        topMods,
        (m) => `**u/${m.username}** — ${m.count} action${m.count !== 1 ? 's' : ''}`,
        'No moderator actions.',
      ),
    );
    lines.push('');
  }

  if (topActionTypes.length > 0) {
    lines.push('**Action Breakdown:**\n');
    lines.push(
      formatBulletList(
        topActionTypes,
        (a) => `**${a.action}** — ${a.count} time${a.count !== 1 ? 's' : ''}`,
        'No action types recorded.',
      ),
    );
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

/**
 * Format the aggregated report data into a readable Markdown string.
 *
 * Sections (each can be disabled via mod settings):
 * 1. Overview — total reports, removals, approvals, posts, comments (with trends)
 * 2. Activity Summary — submission totals, removal/approval rates
 * 3. Rule Violations — top violated rules with counts
 * 4. Repeat Offenders — users with multiple removed content
 * 5. Mod Activity — top moderators by action count + action type breakdown
 *
 * @param report - The aggregated report data from scheduler.ts
 * @param settings - Optional mod settings to control section visibility
 * @returns A formatted Markdown string suitable for posting as a Reddit submission
 */
export function formatReport(report: ReportData, settings?: ModVitalsSettings): string {
  const dateStr = formatDate(report.period.dateKey);
  const lines: string[] = [];

  // Title
  lines.push(`# ModVitals Health Report — ${dateStr}\n`);

  // Generated timestamp
  lines.push(`*Generated at ${new Date(report.generatedAt).toUTCString()}*\n`);

  // Always show Overview (it's the header summary)
  lines.push('---\n');
  lines.push(formatOverview(report));

  // Conditionally show Activity Summary
  lines.push('---\n');

  // Construct metric lines from enabled metrics
  const enabledSections: string[] = [];

  if (!settings || settings.showPosts || settings.showComments) {
    enabledSections.push(formatActivitySummary(report, settings));
  }

  if (!settings || settings.showRuleViolations) {
    enabledSections.push(formatRuleViolations(report));
  }

  if (!settings || settings.showTopOffenders) {
    enabledSections.push(formatRepeatOffenders(report));
  }

  if (!settings || settings.showModActivity) {
    enabledSections.push(formatModActivity(report));
  }

  // If no sections are enabled, show a note
  if (enabledSections.length === 0) {
    lines.push('*All metric sections are disabled in settings.*\n');
  } else {
    lines.push(enabledSections.join('---\n'));
  }

  // Previous period indicator
  if (report.previousPeriod.exists && report.previousPeriod.dateKey) {
    lines.push(`---\n`);
    lines.push(`*Comparison period: ${formatDate(report.previousPeriod.dateKey)}*\n`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utility / date helpers
// ---------------------------------------------------------------------------

/**
 * Format a YYYYMMDD date key into a human-readable date (e.g. "May 24, 2026").
 */
function formatDate(dateKey: string): string {
  const year = parseInt(dateKey.substring(0, 4), 10);
  const month = parseInt(dateKey.substring(4, 6), 10) - 1;
  const day = parseInt(dateKey.substring(6, 8), 10);

  const date = new Date(Date.UTC(year, month, day));
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Build the title for the report post.
 */
export function buildReportTitle(report: ReportData): string {
  const dateStr = formatDate(report.period.dateKey);
  const { metrics } = report.period;
  const totalActions = metrics.removals + metrics.approvals + metrics.posts + metrics.comments;

  if (totalActions === 0 && report.period.topRules.length === 0 && report.period.topOffenders.length === 0) {
    return `ModVitals Health Report — ${dateStr} (No Activity)`;
  }

  return `ModVitals Health Report — ${dateStr}`;
}
