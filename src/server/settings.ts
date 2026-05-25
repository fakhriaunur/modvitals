import { settings } from '@devvit/web/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModVitalsSettings {
  reportFrequency: 'daily' | 'weekly';
  reportHour: number;
  showPosts: boolean;
  showComments: boolean;
  showRemovals: boolean;
  showApprovals: boolean;
  showRuleViolations: boolean;
  showTopOffenders: boolean;
  showModActivity: boolean;
  showKarmaStats: boolean;
  showLeaderboard: boolean;
  showInactiveAlerts: boolean;
  inactiveThresholdDays: number;
}

export const DEFAULT_SETTINGS: ModVitalsSettings = {
  reportFrequency: 'daily',
  reportHour: 12,
  showPosts: true,
  showComments: true,
  showRemovals: true,
  showApprovals: true,
  showRuleViolations: true,
  showTopOffenders: true,
  showModActivity: true,
  showKarmaStats: true,
  showLeaderboard: true,
  showInactiveAlerts: true,
  inactiveThresholdDays: 5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw setting value as boolean.
 * Devvit boolean settings return actual booleans, but we guard against
 * string values just in case.
 */
export function asBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

/**
 * Parse a raw setting value as a number.
 */
export function asNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return isNaN(n) ? defaultValue : n;
  }
  return defaultValue;
}

/**
 * Parse a raw setting value as one of the allowed frequency strings.
 */
export function asFrequency(value: unknown, defaultValue: 'daily' | 'weekly'): 'daily' | 'weekly' {
  if (value === 'daily' || value === 'weekly') return value;
  return defaultValue;
}

// ---------------------------------------------------------------------------
// Settings loader
// ---------------------------------------------------------------------------

/**
 * Load all mod-configurable settings from the Devvit subreddit settings store.
 *
 * Returns the full settings object with defaults applied for any missing or
 * invalid values. This is safe to call on every scheduler invocation — the
 * underlying Redis reads are fast and cached by the runtime.
 */
export async function getSettings(): Promise<ModVitalsSettings> {
  try {
    const [
      reportFrequency,
      reportHour,
      showPosts,
      showComments,
      showRemovals,
      showApprovals,
      showRuleViolations,
      showTopOffenders,
      showModActivity,
      showKarmaStats,
      showLeaderboard,
      showInactiveAlerts,
      inactiveThresholdDays,
    ] = await Promise.all([
      settings.get('reportFrequency'),
      settings.get('reportHour'),
      settings.get('showPosts'),
      settings.get('showComments'),
      settings.get('showRemovals'),
      settings.get('showApprovals'),
      settings.get('showRuleViolations'),
      settings.get('showTopOffenders'),
      settings.get('showModActivity'),
      settings.get('showKarmaStats'),
      settings.get('showLeaderboard'),
      settings.get('showInactiveAlerts'),
      settings.get('inactiveThresholdDays'),
    ]);

    return {
      reportFrequency: asFrequency(reportFrequency, DEFAULT_SETTINGS.reportFrequency),
      reportHour: asNumber(reportHour, DEFAULT_SETTINGS.reportHour),
      showPosts: asBoolean(showPosts, DEFAULT_SETTINGS.showPosts),
      showComments: asBoolean(showComments, DEFAULT_SETTINGS.showComments),
      showRemovals: asBoolean(showRemovals, DEFAULT_SETTINGS.showRemovals),
      showApprovals: asBoolean(showApprovals, DEFAULT_SETTINGS.showApprovals),
      showRuleViolations: asBoolean(showRuleViolations, DEFAULT_SETTINGS.showRuleViolations),
      showTopOffenders: asBoolean(showTopOffenders, DEFAULT_SETTINGS.showTopOffenders),
      showModActivity: asBoolean(showModActivity, DEFAULT_SETTINGS.showModActivity),
      showKarmaStats: asBoolean(showKarmaStats, DEFAULT_SETTINGS.showKarmaStats),
      showLeaderboard: asBoolean(showLeaderboard, DEFAULT_SETTINGS.showLeaderboard),
      showInactiveAlerts: asBoolean(showInactiveAlerts, DEFAULT_SETTINGS.showInactiveAlerts),
      inactiveThresholdDays: asNumber(inactiveThresholdDays, DEFAULT_SETTINGS.inactiveThresholdDays),
    };
  } catch (err) {
    console.warn('[settings] failed to load settings, using defaults', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Determine if a report should be generated based on the configured frequency,
 * report hour, and the current time.
 *
 * The cron runs every minute (heartbeat). This function checks whether the
 * configured conditions are met:
 *
 * - Daily: only generate when current UTC hour matches reportHour.
 * - Weekly: only generate on Mondays when current UTC hour matches reportHour.
 */
export function shouldGenerateReport(
  frequency: 'daily' | 'weekly',
  reportHour: number = 12,
): boolean {
  const now = new Date();
  const currentHour = now.getUTCHours();

  // Hour guard – only run during the configured report hour
  if (currentHour !== reportHour) return false;

  // Frequency guard
  if (frequency === 'daily') return true;
  // weekly: only on Mondays
  return now.getUTCDay() === 1;
}
