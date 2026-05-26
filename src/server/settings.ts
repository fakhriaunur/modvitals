import { settings } from '@devvit/web/server';
import { matchCron } from './cron-matcher.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportFrequency = 'hourly' | '4-hourly' | '12-hourly' | 'daily' | 'weekly' | 'custom';

export interface ModVitalsSettings {
  reportFrequency: ReportFrequency;
  /** Hour of day (0-23) in the configured timezone used for daily/weekly presets */
  reportHour: number;
  /** Minute of hour (0-59) used for hourly/4-hourly/12-hourly presets */
  reportMinute: number;
  /** Custom cron expression (5-field) used when frequency='custom' */
  customCron: string;
  /** Timezone offset in minutes from UTC (e.g. -300 for UTC-5, 480 for UTC+8) */
  timezoneOffset: number;
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
  showAnomalyAlerts: boolean;
}

export const DEFAULT_SETTINGS: ModVitalsSettings = {
  reportFrequency: 'daily',
  reportHour: 12,
  reportMinute: 0,
  customCron: '0 12 * * *',
  timezoneOffset: 0,
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
  showAnomalyAlerts: true,
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
export function asFrequency(value: unknown, defaultValue: ReportFrequency): ReportFrequency {
  const valid: ReportFrequency[] = ['hourly', '4-hourly', '12-hourly', 'daily', 'weekly', 'custom'];
  if (typeof value === 'string' && (valid as string[]).includes(value)) return value as ReportFrequency;
  return defaultValue;
}

/**
 * Parse a raw setting value as a timezone offset in minutes.
 * Accepts a number (offset in minutes) or a string like "-300" or "UTC-5".
 * Falls back to defaultValue (0 = UTC).
 */
export function asTimezoneOffset(value: unknown, defaultValue: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= -720 && value <= 840) {
    return value;
  }
  if (typeof value === 'string') {
    // Try parsing as raw number string
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= -720 && n <= 840) return n;
    // Try parsing "UTC+5", "UTC-5", "UTC+05:30" style
    const match = value.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i);
    if (match) {
      const sign = match[1] === '+' ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      const offset = sign * (hours * 60 + minutes);
      if (offset >= -720 && offset <= 840) return offset;
    }
  }
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
      reportMinute,
      customCron,
      timezoneOffset,
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
      showAnomalyAlerts,
    ] = await Promise.all([
      settings.get('reportFrequency'),
      settings.get('reportHour'),
      settings.get('reportMinute'),
      settings.get('customCron'),
      settings.get('timezoneOffset'),
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
      settings.get('showAnomalyAlerts'),
    ]);

    return {
      reportFrequency: asFrequency(reportFrequency, DEFAULT_SETTINGS.reportFrequency),
      reportHour: asNumber(reportHour, DEFAULT_SETTINGS.reportHour),
      reportMinute: asNumber(reportMinute, DEFAULT_SETTINGS.reportMinute),
      customCron: typeof customCron === 'string' ? customCron : DEFAULT_SETTINGS.customCron,
      timezoneOffset: asTimezoneOffset(timezoneOffset, DEFAULT_SETTINGS.timezoneOffset),
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
      showAnomalyAlerts: asBoolean(showAnomalyAlerts, DEFAULT_SETTINGS.showAnomalyAlerts),
    };
  } catch (err) {
    console.warn('[settings] failed to load settings, using defaults', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Apply a timezone offset (in minutes) to a Date and return hour/minute/day
 * pre-adjusted to that timezone.
 *
 * Pure function — no side effects.
 */
function adjustDate(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
}

/**
 * Determine if a report should be generated based on the configured frequency,
 * report time, and the current time.
 *
 * The cron runs every minute (heartbeat). This function checks whether the
 * configured conditions are met:
 *
 * - hourly:   fires when current minute matches reportMinute (every hour)
 * - 4-hourly: fires at hours 0,4,8,12,16,20 at reportMinute
 * - 12-hourly: fires at hours 0,12 at reportMinute
 * - daily:    fires when current UTC hour matches reportHour (existing behavior)
 * - weekly:   fires on Mondays when current UTC hour matches reportHour
 * - custom:   evaluates the customCron 5-field expression
 *
 * If timezoneOffset is non-zero, the local timezone-adjusted time is used
 * for all comparisons.
 */
export function shouldGenerateReport(
  frequency: ReportFrequency,
  reportHour: number = 12,
  reportMinute: number = 0,
  customCron?: string,
  timezoneOffset: number = 0,
): boolean {
  const now = new Date();
  const ref = timezoneOffset !== 0 ? adjustDate(now, timezoneOffset) : now;

  const currentHour = ref.getUTCHours();
  const currentMinute = ref.getUTCMinutes();
  const currentDay = ref.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  switch (frequency) {
    case 'hourly':
      return currentMinute === reportMinute;

    case '4-hourly':
      return currentHour % 4 === 0 && currentMinute === reportMinute;

    case '12-hourly':
      return (currentHour === 0 || currentHour === 12) && currentMinute === reportMinute;

    case 'daily':
      return currentHour === reportHour && currentMinute === reportMinute;

    case 'weekly':
      return currentDay === 1 && currentHour === reportHour && currentMinute === reportMinute;

    case 'custom':
      if (!customCron) return false;
      return matchCron(customCron, ref);

    default:
      return false;
  }
}
