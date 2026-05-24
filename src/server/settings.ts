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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw setting value as boolean.
 * Devvit boolean settings return actual booleans, but we guard against
 * string values just in case.
 */
function asBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

/**
 * Parse a raw setting value as a number.
 */
function asNumber(value: unknown, defaultValue: number): number {
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
function asFrequency(value: unknown, defaultValue: 'daily' | 'weekly'): 'daily' | 'weekly' {
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
    };
  } catch (err) {
    console.warn('[settings] failed to load settings, using defaults', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Determine if a report should be generated based on the configured frequency
 * and the current date.
 *
 * - Daily: always generate
 * - Weekly: only generate on Mondays (day-of-week === 1)
 */
export function shouldGenerateReport(frequency: 'daily' | 'weekly'): boolean {
  if (frequency === 'daily') return true;
  // weekly: only on Mondays
  return new Date().getUTCDay() === 1;
}
