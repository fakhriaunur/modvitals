import { reddit } from '@devvit/web/server';

// ---------------------------------------------------------------------------
// Posting API
// ---------------------------------------------------------------------------

/**
 * Submit a report post to the current subreddit, distinguish it as a mod
 * post, and approve it for mod-only visibility.
 *
 * Posting is decoupled from report formatting so that:
 * - Formatting can be unit-tested without mocking the Reddit API
 * - The output sink is pluggable (modmail, Discord, wiki, etc.)
 *
 * @param title - The title of the report post
 * @param body  - The Markdown body of the report post
 * @returns An object containing the Reddit post ID and its permanent link.
 */
export async function postReportToSubreddit(
  title: string,
  body: string,
): Promise<{ postId: string; url: string }> {
  console.log('[posting] submitting report post', {
    title,
    bodyLength: body.length,
  });

  const post = await reddit.submitPost({
    title,
    text: body,
  });

  console.log('[posting] post submitted', {
    postId: post.id,
    postTitle: post.title,
  });

  // Make the post mod-only visibility:
  // 1. Distinguish as a moderator post (green [M] shield)
  // 2. Approve the post (marks as reviewed by mod team)
  try {
    await post.distinguish();
    await post.approve();
    console.log('[posting] post marked as distinguished mod post');
  } catch (modErr) {
    // Non-blocking: post was submitted even if mod-only flags fail
    console.warn('[posting] could not set mod-only flags', modErr);
  }

  return { postId: post.id, url: post.permalink };
}
