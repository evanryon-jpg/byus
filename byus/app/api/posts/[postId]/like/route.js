export const dynamic = 'force-dynamic';

// POST /api/posts/:postId/like
// Toggles the logged-in viewer's like on a post. Uses the exact same access rule
// as voting and the post's own body/media: public posts (not pending review) are
// open to anyone logged in, subscribers-only posts require an active
// subscription, and the post's own creator is always authorized.
//
// Unlike a poll vote, a like has no value to move -- it's a plain on/off per
// (post, fan) pair -- so this inserts or deletes the row rather than upserting
// a column, mirroring the shape of post_likes itself (see
// database/migrations/20260918_post_likes_and_views.sql).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request, { params }) {
  const { postId } = params;
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Log in to like this.' }, { status: 401 });
  }

  const rateCheck = await checkRateLimit('post-like', `user:${session.userId}`);
  if (!rateCheck.success) {
    return rateLimitResponse(rateCheck);
  }

  try {
    const postResult = await query(
      `SELECT id, creator_id, visibility, pending_review FROM posts WHERE id = $1`,
      [postId]
    );
    const post = postResult.rows[0];
    if (!post) {
      return NextResponse.json({ error: 'This post no longer exists.' }, { status: 404 });
    }

    const isOwner = session.userId === post.creator_id;
    // A pending-review post is never public, no matter what its own visibility column
    // says -- same rule the vote route and media route enforce; only its own creator
    // can interact with it while ByUs's one-time initial review is pending.
    let isAuthorized = (post.visibility === 'public' && !post.pending_review) || isOwner;
    if (!isAuthorized) {
      // Same reconciling check used everywhere else content is gated: trust the
      // paid-through date over the cached status column in case a webhook was missed.
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
           AND (current_period_end IS NULL OR current_period_end > now())`,
        [session.userId, post.creator_id]
      );
      isAuthorized = subResult.rows.length > 0;
    }
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'You need an active subscription to like this.' },
        { status: 403 }
      );
    }

    const existing = await query(
      `SELECT id FROM post_likes WHERE post_id = $1 AND fan_id = $2`,
      [postId, session.userId]
    );

    let likedByMe;
    if (existing.rows.length > 0) {
      await query(`DELETE FROM post_likes WHERE post_id = $1 AND fan_id = $2`, [
        postId,
        session.userId,
      ]);
      likedByMe = false;
    } else {
      await query(
        `INSERT INTO post_likes (post_id, fan_id) VALUES ($1, $2) ON CONFLICT (post_id, fan_id) DO NOTHING`,
        [postId, session.userId]
      );
      likedByMe = true;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1`,
      [postId]
    );

    return NextResponse.json({ likeCount: countResult.rows[0].count, likedByMe });
  } catch (err) {
    console.error('posts/[postId]/like POST failed:', err);
    return NextResponse.json({ error: 'Could not update your like. Try again.' }, { status: 500 });
  }
}
