export const dynamic = 'force-dynamic';

// GET /api/creators/:creatorId
// Public creator profile: basic info, their tiers, and their feed —
// with subscribers-only posts hidden unless the requester has an active subscription.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request, { params }) {
  const { creatorId } = params;
  const session = getCurrentUser(); // may be null if the visitor isn't logged in — that's fine

  try {
    const creatorResult = await query(
      `SELECT id, display_name, bio, profile_image_url FROM users WHERE id = $1 AND role = 'creator'`,
      [creatorId]
    );
    const creator = creatorResult.rows[0];
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }

    const tiersResult = await query(
      `SELECT id, name, description, price_cents FROM subscription_tiers
       WHERE creator_id = $1 AND active = true ORDER BY price_cents ASC`,
      [creatorId]
    );

    // Does the visitor have an active subscription to THIS creator?
    let hasActiveSubscription = false;
    if (session) {
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'`,
        [session.userId, creatorId]
      );
      hasActiveSubscription = subResult.rows.length > 0;
    }

    const postsResult = await query(
      `SELECT id, title, body, media_url, visibility, created_at
       FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
      [creatorId]
    );

    // Gate content here, server-side — never trust the client to hide this on its own.
    const posts = postsResult.rows.map((post) => {
      const isLocked = post.visibility === 'subscribers_only' && !hasActiveSubscription;
      return {
        id: post.id,
        title: post.title,
        created_at: post.created_at,
        visibility: post.visibility,
        locked: isLocked,
        body: isLocked ? null : post.body,
        media_url: isLocked ? null : post.media_url,
      };
    });

    return NextResponse.json({
      creator,
      tiers: tiersResult.rows,
      hasActiveSubscription,
      posts,
    });
  } catch (err) {
    console.error('creators/[creatorId] GET failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not load this creator. Try again.' },
      { status: 500 }
    );
  }
}
