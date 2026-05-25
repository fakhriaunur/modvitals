import { reddit } from '@devvit/web/server';
import { storeKarmaSnapshot, getKarmaSnapshotsForDate } from './metrics.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Karma information for a single user, fetched from the Reddit API.
 * null indicates the user could not be fetched (deleted/suspended).
 */
export interface KarmaInfo {
  linkKarma: number;
  commentKarma: number;
  accountCreatedAt: Date;
  snoovatarUrl?: string;
  subredditKarma?: { fromComments?: number; fromPosts?: number };
}

// ---------------------------------------------------------------------------
// Karma fetching
// ---------------------------------------------------------------------------

/**
 * Fetch karma data for a single user from the Reddit API.
 *
 * Handles:
 * - Deleted/suspended users (returns null without throwing)
 * - Rate limiting and network errors (caught per-user)
 * - Missing optional data (snoovatar, subreddit karma)
 *
 * @param username - Reddit username (without u/ prefix)
 * @returns KarmaInfo if the user exists, null if not found or error
 */
export async function fetchUserKarma(username: string): Promise<KarmaInfo | null> {
  try {
    const user = await reddit.getUserByUsername(username);
    if (!user) {
      console.warn('[karma] user not found', { username });
      return null;
    }

    // Fetch optional data in parallel; don't fail if either is unavailable
    const [snoovatarResult, subKarmaResult] = await Promise.allSettled([
      user.getSnoovatarUrl(),
      user.getUserKarmaFromCurrentSubreddit(),
    ]);

    const snoovatarUrl =
      snoovatarResult.status === 'fulfilled' ? snoovatarResult.value : undefined;
    const subredditKarma =
      subKarmaResult.status === 'fulfilled' ? subKarmaResult.value : undefined;

    if (snoovatarResult.status === 'rejected') {
      console.warn('[karma] snoovatar fetch failed', { username, err: snoovatarResult.reason });
    }
    if (subKarmaResult.status === 'rejected') {
      console.warn('[karma] subreddit karma fetch failed', { username, err: subKarmaResult.reason });
    }

    return {
      linkKarma: user.linkKarma,
      commentKarma: user.commentKarma,
      accountCreatedAt: user.createdAt,
      snoovatarUrl,
      subredditKarma,
    };
  } catch (err) {
    console.error('[karma] failed to fetch user karma', { username, err });
    return null;
  }
}

/**
 * Fetch karma data for multiple users concurrently.
 * Each user is fetched individually; errors from one do not affect others.
 *
 * @param usernames - Array of Reddit usernames
 * @returns A Map of username → KarmaInfo | null for fetched users
 */
export async function fetchUsersKarma(
  usernames: string[],
): Promise<Map<string, KarmaInfo | null>> {
  const results = await Promise.allSettled(
    usernames.map((u) => fetchUserKarma(u)),
  );

  const map = new Map<string, KarmaInfo | null>();
  for (let i = 0; i < usernames.length; i++) {
    const result = results[i];
    map.set(
      usernames[i],
      result.status === 'fulfilled' ? result.value : null,
    );
  }
  return map;
}

// ---------------------------------------------------------------------------
// Snapshot persistence
// ---------------------------------------------------------------------------

/**
 * Store karma snapshots for all offenders into Redis for period-over-period
 * delta comparison.
 *
 * @param dateKey - The date key (YYYYMMDD) for the snapshot
 * @param karmaMap - Map of username → KarmaInfo (only non-null entries stored)
 */
export async function storeOffenderKarmaSnapshots(
  dateKey: string,
  karmaMap: Map<string, KarmaInfo | null>,
): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [username, info] of karmaMap) {
    if (info !== null) {
      promises.push(
        storeKarmaSnapshot(dateKey, username, info.linkKarma, info.commentKarma),
      );
    }
  }
  await Promise.allSettled(promises);
}

/**
 * Compute karma delta for a user between two periods.
 * Returns the change in link and comment karma from previous to current.
 */
export async function getKarmaDelta(
  username: string,
  currentDateKey: string,
  previousDateKey: string,
): Promise<{ linkDelta: number; commentDelta: number } | null> {
  try {
    const currentSnapshots = await getKarmaSnapshotsForDate(currentDateKey);
    const previousSnapshots = await getKarmaSnapshotsForDate(previousDateKey);

    const current = currentSnapshots[username];
    const previous = previousSnapshots[username];

    if (!current || !previous) return null;

    return {
      linkDelta: current.linkKarma - previous.linkKarma,
      commentDelta: current.commentKarma - previous.commentKarma,
    };
  } catch (err) {
    console.error('[karma] failed to compute karma delta', { username, currentDateKey, previousDateKey, err });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure)
// ---------------------------------------------------------------------------

/**
 * Format a numeric karma value for display.
 * - >= 1000: "1.2k" (rounded to 1 decimal)
 * - < 1000: raw number
 */
export function formatKarmaDisplay(value: number): string {
  if (Math.abs(value) >= 1000) {
    const k = (value / 1000).toFixed(1);
    return `${k}k`;
  }
  return String(value);
}

/**
 * Format account age from creation date to a human-readable string.
 * Examples: "3mo account", "1y 2mo account", "0mo account"
 *
 * Accepts a currentDate parameter for deterministic/pure usage (no new Date() internally).
 */
export function formatAccountAge(createdAt: Date, currentDate: Date): string {
  let years = currentDate.getUTCFullYear() - createdAt.getUTCFullYear();
  let months = currentDate.getUTCMonth() - createdAt.getUTCMonth();

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  if (years > 0) {
    return `${years}y ${months}mo account`;
  }
  return `${totalMonths}mo account`;
}

/**
 * Format total karma (link + comment) for display.
 */
export function formatTotalKarma(linkKarma: number, commentKarma: number): string {
  return formatKarmaDisplay(linkKarma + commentKarma);
}

/**
 * Format subreddit-specific karma for display.
 * Returns the sum of fromComments and fromPosts, with sign.
 */
export function formatSubredditKarma(
  subKarma?: { fromComments?: number; fromPosts?: number },
): string | null {
  if (!subKarma) return null;
  const total = (subKarma.fromComments ?? 0) + (subKarma.fromPosts ?? 0);
  if (total === 0) return null;
  const sign = total >= 0 ? '+' : '';
  return `${sign}${total} sub karma`;
}
