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
    `SELECT id, title, body, media_url, visibility, poll_options, pending_review, created_at
     FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
    [creatorId]
  );
  const pollPostIds = result.rows.filter((p) => p.poll_options).map((p) => p.id);
  const voteCounts = await getPollVoteCounts(pollPostIds);

  // media_url in the DB is a private Blob pathname, never expose it directly —
  // point the client at our own gated route instead.
  return result.rows.map((post) => ({
    ...post,
    media_url: post.media_url ? `/api/posts/${post.id}/media` : null,
    poll: buildPollPayload(post, voteCounts[post.id]),
  }));
}

export async function loadCreatorLinks(creatorId) {
  const result = await query('SELECT social_links FROM users WHERE id = $1', [creatorId]);
  return result.rows[0]?.social_links || [];
}
