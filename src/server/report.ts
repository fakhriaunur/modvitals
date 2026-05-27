import type { ReportData, TrendData, LeaderboardEntry, AnomalyData } from './scheduler-logic.js';
import type { ModVitalsSettings } from './settings.js';
import { resolveEffectiveCron } from './settings.js';
import { formatDate } from './date-utils.js';
import {
  formatAccountAge,
  formatTotalKarma,
  formatSubredditKarma,
} from './karma.js';
import type { KarmaInfo } from './karma.js';

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
 * Respects metric visibility settings: showRemovals, showApprovals, showPosts, showComments.
 * Reports are always shown (no toggle exists for reports).
 */
function formatOverview(report: ReportData, settings?: ModVitalsSettings): string {
  const { metrics } = report.period;
  const { trends } = report;

  const lines: string[] = ['### Overview\n'];

  const totalActions =
    (settings?.showRemovals !== false ? metrics.removals : 0) +
    (settings?.showApprovals !== false ? metrics.approvals : 0) +
    (settings?.showPosts !== false ? metrics.posts : 0) +
    (settings?.showComments !== false ? metrics.comments : 0);

  if (totalActions === 0 && report.period.topRules.length === 0 && report.period.topOffenders.length === 0) {
    lines.push('No activity in this period.\n');
    return lines.join('\n');
  }

  // Reports always shown — no toggle for reports
  lines.push(`- **Total Reports:** ${formatWithTrend(metrics.reports, trends.reports)}`);

  if (!settings || settings.showRemovals) {
    lines.push(`- **Removals:** ${formatWithTrend(metrics.removals, trends.removals)}`);
  }
  if (!settings || settings.showApprovals) {
    lines.push(`- **Approvals:** ${formatWithTrend(metrics.approvals, trends.approvals)}`);
  }
  if (!settings || settings.showPosts) {
    lines.push(`- **Posts:** ${formatWithTrend(metrics.posts, trends.posts)}`);
  }
  if (!settings || settings.showComments) {
    lines.push(`- **Comments:** ${formatWithTrend(metrics.comments, trends.comments)}`);
  }
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
 * Format a single offender entry with optional karma stats.
 */
function formatOffenderLine(
  username: string,
  score: number,
  karma?: KarmaInfo | null,
  now?: Date,
): string {
  let parts: string[] = [];

  // Snoovatar image if available
  if (karma?.snoovatarUrl) {
    parts.push(`![snoovatar](${karma.snoovatarUrl})`);
  }

  // Username
  parts.push(`**u/${username}**`);

  // Karma stats in parentheses
  if (karma) {
    const stats: string[] = [];

    // Account age
    stats.push(formatAccountAge(karma.accountCreatedAt, now ?? new Date()));

    // Total karma (link + comment)
    const totalKarma = formatTotalKarma(karma.linkKarma, karma.commentKarma);
    stats.push(`${totalKarma} karma`);

    // Subreddit-specific karma
    const subKarma = formatSubredditKarma(karma.subredditKarma);
    if (subKarma) {
      stats.push(subKarma);
    }

    if (stats.length > 0) {
      parts.push(`(${stats.join(', ')})`);
    }
  }

  // Incident count
  parts.push(`— ${score} incident${score !== 1 ? 's' : ''}`);

  return parts.join(' ');
}

/**
 * Format the Repeat Offenders section.
 */
function formatRepeatOffenders(report: ReportData, settings?: ModVitalsSettings): string {
  const { topOffenders, offenderKarma } = report.period;

  const lines: string[] = ['### Repeat Offenders\n'];

  if (topOffenders.length === 0) {
    lines.push('No repeat offenders.\n');
    return lines.join('\n');
  }

  const showKarma = !settings || settings.showKarmaStats;
  const now = new Date(report.generatedAt);

  lines.push(
    formatBulletList(
      topOffenders,
      (o) => {
        if (showKarma) {
          const karma = offenderKarma?.[o.username];
          return formatOffenderLine(o.username, o.score, karma, now);
        }
        return `**u/${o.username}** — ${o.score} incident${o.score !== 1 ? 's' : ''}`;
      },
      'No repeat offenders.',
    ),
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the Mod Activity section.
 * Supports ranked leaderboard, workload balance percentages, and inactive alerts.
 */
function formatModActivity(report: ReportData, settings?: ModVitalsSettings): string {
  const { topMods, topActionTypes, leaderboard } = report.period;

  const lines: string[] = ['### Mod Activity\n'];

  const showLeaderboardFlag = !settings || settings.showLeaderboard;
  const showInactiveFlag = !settings || settings.showInactiveAlerts;

  if (topMods.length === 0 && topActionTypes.length === 0) {
    lines.push('No moderator activity recorded.\n');
    return lines.join('\n');
  }

  // --- Leaderboard section ---
  if (showLeaderboardFlag && leaderboard.length > 0) {
    // Check if all leaderboard entries are inactive
    const allInactive = leaderboard.length > 0 && leaderboard.every((e) => e.isInactive);
    const allZero = leaderboard.every((e) => e.count === 0);

    if (allInactive && allZero) {
      // Special message when all mods are inactive
      lines.push('All moderators are currently inactive — no actions taken in this period.\n');
    } else {
      lines.push('**Top Moderators (Leaderboard):**\n');

      const entries = leaderboard.map((entry, idx) => {
        const prefix = `${idx + 1}. `;

        if (showInactiveFlag && entry.isInactive) {
          return `${prefix}⚠️ u/${entry.username} — ${entry.count} action${entry.count !== 1 ? 's' : ''} (${entry.pct}%) — Inactive ${entry.daysSinceLastAction ?? 0} days`;
        }

        if (entry.isMostActive) {
          return `${prefix}u/${entry.username} — ${entry.count} action${entry.count !== 1 ? 's' : ''} (${entry.pct}%) [Most Active]`;
        }

        return `${prefix}u/${entry.username} — ${entry.count} action${entry.count !== 1 ? 's' : ''} (${entry.pct}%)`;
      });

      lines.push(entries.join('\n'));
      lines.push('');
    }
  } else if (topMods.length > 0) {
    // Fallback to simple list when leaderboard is disabled
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

  // --- Action Breakdown ---
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
// Anomaly Alerts Section
// ---------------------------------------------------------------------------

/**
 * Format the anomaly alerts section for the report.
 *
 * When anomalies are detected, produces a top-of-report section like:
 *
 *   ### ⚠️ Anomaly Alerts
 *
 *   - ⚠️ Unusual activity detected: 300% more removals than average (12 vs 4 avg).
 *     Possible brigading or spam wave.
 *
 * When insufficient history (< 7 days), produces a baseline message:
 *
 *   Collecting baseline — anomaly detection requires 7 days of data (X days collected).
 *
 * Returns an empty string when no alerts and sufficient data (no section shown).
 */
function formatAlertsSection(anomalyData?: AnomalyData, showAnomalyAlerts?: boolean): string {
  if (!showAnomalyAlerts || !anomalyData) return '';

  const lines: string[] = [];

  if (!anomalyData.hasSufficientData) {
    lines.push('### ⚠️ Anomaly Detection\n');
    const days = anomalyData.baselineDays;
    lines.push(
      `Collecting baseline — anomaly detection requires 7 days of data (${days} day${days !== 1 ? 's' : ''} collected so far).\n`,
    );
    return lines.join('\n');
  }

  if (anomalyData.alerts.length === 0) return '';

  lines.push('### ⚠️ Anomaly Alerts\n');

  for (const alert of anomalyData.alerts) {
    const label = alert.label.charAt(0).toUpperCase() + alert.label.slice(1);
    lines.push(
      `- ⚠️ Unusual activity detected: ${alert.percentOfAverage}% more ${alert.label} than average (${alert.currentValue} vs ${Math.round(alert.averageValue)} avg). Possible brigading or spam wave.`,
    );
  }

  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Debug Info Section
// ---------------------------------------------------------------------------

/**
 * Format the debug info header showing current configuration and settings.
 * Only shown when showDebugInfo is enabled in mod settings.
 */
function formatDebugInfo(settings: ModVitalsSettings): string {
  const lines: string[] = ['### Debug Info\n'];

  // Format timezone string from offset
  const offsetHours = Math.floor(Math.abs(settings.timezoneOffset) / 60);
  const offsetMins = Math.abs(settings.timezoneOffset) % 60;
  const sign = settings.timezoneOffset >= 0 ? '+' : '-';
  const tzLabel = `UTC${sign}${offsetHours}${offsetMins > 0 ? `:${String(offsetMins).padStart(2, '0')}` : ''}`;

  lines.push(`- Report Frequency: ${settings.reportFrequency}`);
  lines.push(`- Effective Cron: ${resolveEffectiveCron(settings)} (${settings.reportFrequency} preset)`);
  lines.push(`- Report Hour: ${settings.reportHour}`);
  lines.push(`- Report Minute: ${settings.reportMinute}`);
  lines.push(`- Timezone: ${tzLabel} (offset: ${settings.timezoneOffset})`);
  lines.push(`- Show Posts: ${settings.showPosts}`);
  lines.push(`- Show Comments: ${settings.showComments}`);
  lines.push(`- Show Removals: ${settings.showRemovals}`);
  lines.push(`- Show Approvals: ${settings.showApprovals}`);
  lines.push(`- Show Rule Violations: ${settings.showRuleViolations}`);
  lines.push(`- Show Repeat Offenders: ${settings.showTopOffenders}`);
  lines.push(`- Show Mod Activity: ${settings.showModActivity}`);
  lines.push(`- Show Karma Stats: ${settings.showKarmaStats}`);
  lines.push(`- Show Leaderboard: ${settings.showLeaderboard}`);
  lines.push(`- Show Inactive Alerts: ${settings.showInactiveAlerts}`);
  lines.push(`- Inactive Threshold: ${settings.inactiveThresholdDays} days`);
  lines.push(`- Show Anomaly Alerts: ${settings.showAnomalyAlerts}`);
  lines.push('');

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

  // Debug info — only shown when showDebugInfo is enabled
  if (settings?.showDebugInfo) {
    lines.push(formatDebugInfo(settings));
    lines.push('---\n');
  }

  // Anomaly alerts section — appears at the top when anomalies detected
  const alertsSection = formatAlertsSection(
    report.anomalyData,
    !settings || settings.showAnomalyAlerts,
  );
  if (alertsSection) {
    lines.push(alertsSection);
    lines.push('---\n');
  }

  // Always show Overview (it's the header summary)
  lines.push('---\n');
  lines.push(formatOverview(report, settings));

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
    enabledSections.push(formatRepeatOffenders(report, settings));
  }

  if (!settings || settings.showModActivity) {
    enabledSections.push(formatModActivity(report, settings));
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
