// Shared "load this creator's dashboard data" loaders. Originally three separate
// blocks of query logic inline in app/api/creator/tiers/route.js,
// app/api/creator/posts/route.js, and app/api/creator/links/route.js — pulled out
// here so the creator dashboard's server-side initial load (app/creator/dashboard/page.js)
// can produce the exact same shape those endpoints return without a second,
// silently-drifting copy of the SQL. Callers are still responsible for their own
// getCurrentUser() + role check before calling these — none of them check
// authorization themselves.

import { query } from '@/lib/db';
import { getPollVoteCounts, buildPollPayload } from '@/lib/polls';
import { signPlaybackToken } from '@/lib/mux-jwt';

export async function loadCreatorTiers(creatorId) {
  const result = await query(
    `SELECT id, name, description, price_cents, annual_price_cents, welcome_message, trial_days,
            stripe_product_id, active, created_at
     FROM subscription_tiers WHERE creator_id = $1 ORDER BY price_cents ASC`,
    [creatorId]
  );
  return result.rows;
}

export async function loadCreatorPosts(creatorId) {
  const result = await query(
    `SELECT id, title, body, media_url, visibility, poll_options, pending_review, created_at, mux_playback_id, view_count
     FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
    [creatorId]
  );
  const pollPostIds = result.rows.filter((p) => p.poll_options).map((p) => p.id);
  const voteCounts = await getPollVoteCounts(pollPostIds);

  // Like counts, shown to the creator alongside view_count -- see the fan-facing like
  // button in app/creator/[creatorId]/ProfileClient.js for where these rows come from.
  const postIds = result.rows.map((p) => p.id);
  const likeCounts = {};
  if (postIds.length > 0) {
    const likeCountsResult = await query(
      `SELECT post_id, COUNT(*)::int AS count FROM post_likes WHERE post_id = ANY($1) GROUP BY post_id`,
      [postIds]
    );
    for (const row of likeCountsResult.rows) likeCounts[row.post_id] = row.count;
  }

  // media_url in the DB is a private Blob pathname, never expose it directly —
  // point the client at our own gated route instead.
  return result.rows.map((post) => {
    // eslint-disable-next-line no-unused-vars -- pulled out so it's never echoed raw
    const { mux_playback_id, ...rest } = post;
    // A creator previewing their own dashboard is always allowed to see their own
    // video, subscribers-only or not — no subscription check needed, just sign it.
    let video = null;
    if (mux_playback_id) {
      try {
        video = { playbackId: mux_playback_id, playbackToken: signPlaybackToken(mux_playback_id) };
      } catch (err) {
        console.error('failed to sign video playback token (dashboard preview):', err);
      }
    }
    return {
      ...rest,
      media_url: post.media_url ? `/api/posts/${post.id}/media` : null,
      hasVideo: Boolean(mux_playback_id),
      video,
      poll: buildPollPayload(post, voteCounts[post.id]),
      like_count: likeCounts[post.id] || 0,
    };
  });
}

export async function loadCreatorLinks(creatorId) {
  const result = await query('SELECT social_links FROM users WHERE id = $1', [creatorId]);
  return result.rows[0]?.social_links || [];
}
