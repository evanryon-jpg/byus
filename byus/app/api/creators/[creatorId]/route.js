export const dynamic = 'force-dynamic';

// GET /api/creators/:creatorId
// Public creator profile: basic info, their tiers, and their feed —
// with subscribers-only posts hidden unless the requester has an active subscription.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request, { params }) {
  const { creatorId } = params;
  const session = await getCurrentUser(); // may be null if the visitor isn't logged in — that's fine

  try {
    // Links can point at a creator by their raw UUID (old/already-shared links, or any
    // creator who hasn't claimed a vanity URL) or by their slug (new short links). A UUID
    // always matches the id column directly; anything else can only ever be a slug.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId);
    const creatorResult = await query(
      isUuid
        ? `SELECT id, display_name, bio, profile_image_url, social_links, slug FROM users WHERE id = $1 AND role = 'creator'`
        : `SELECT id, display_name, bio, profile_image_url, social_links, slug FROM users WHERE slug = $1 AND role = 'creator'`,
      [creatorId]
    );
    const creatorRow = creatorResult.rows[0];
    if (!creatorRow) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }
    const id = creatorRow.id; // resolved UUID — everything below queries by this, not the raw param
    // profile_image_url in the DB is a private Blob pathname — point the
    // client at our own public proxy route instead of exposing it directly.
    const creator = {
      ...creatorRow,
      profile_image_url: creatorRow.profile_image_url ? `/api/avatar/${creatorRow.id}` : null,
      social_links: creatorRow.social_links || [],
    };

    const tiersResult = await query(
      `SELECT id, name, description, price_cents FROM subscription_tiers
       WHERE creator_id = $1 AND active = true ORDER BY price_cents ASC`,
      [id]
    );

    // Does the visitor have an active subscription to THIS creator?
    // Cross-check current_period_end against now(), not just the cached status column —
    // status only updates on a webhook, so a missed one (delivery failure, outage) could
    // otherwise leave a lapsed subscription reading as active indefinitely.
    let hasActiveSubscription = false;
    if (session) {
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
           AND (current_period_end IS NULL OR current_period_end > now())`,
        [session.userId, id]
      );
      hasActiveSubscription = subResult.rows.length > 0;
    }

    const postsResult = await query(
      `SELECT id, title, body, media_url, visibility, created_at
       FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Gate content here, server-side — never trust the client to hide this on its own.
    // media_url in the DB is a private Blob pathname; unlocked posts get pointed at
    // our own gated route instead of the raw pathname.
    const posts = postsResult.rows.map((post) => {
      const isLocked = post.visibility === 'subscribers_only' && !hasActiveSubscription;
      return {
        id: post.id,
        title: post.title,
        created_at: post.created_at,
        visibility: post.visibility,
        locked: isLocked,
        body: isLocked ? null : post.body,
        media_url: isLocked || !post.media_url ? null : `/api/posts/${post.id}/media`,
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
      { error: 'Could not load this creator. Try again.' },
      { status: 500 }
    );
  }
}
