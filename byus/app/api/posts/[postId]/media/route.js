export const dynamic = 'force-dynamic';

// GET /api/posts/:postId/media
// Streams a post's image out of private Blob storage, but only to viewers
// who are allowed to see it: the post's own creator, or a fan with an
// active subscription when the post is subscribers-only (public posts'
// media is open to anyone).

import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request, { params }) {
  const { postId } = params;
  const session = await getCurrentUser(); // may be null if the visitor isn't logged in

  try {
    const postResult = await query(
      `SELECT creator_id, media_url, visibility FROM posts WHERE id = $1`,
      [postId]
    );
    const post = postResult.rows[0];
    if (!post || !post.media_url) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const isOwner = session && session.userId === post.creator_id;
    let isAuthorized = post.visibility === 'public' || isOwner;

    if (!isAuthorized && session) {
      // Cross-check current_period_end against now(), not just the cached status column.
      // status is only ever updated by a webhook — if one is ever missed (a delivery
      // failure, an outage), a canceled or lapsed subscription's status can stay stuck
      // at 'active' with no reconciliation job to catch it. Requiring the period to
      // still be current means access self-corrects at the paid-through date even if
      // the webhook that should have flipped status never arrives.
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
        { error: 'You need an active subscription to view this.' },
        { status: 403 }
      );
    }

    const result = await get(post.media_url, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('posts/[postId]/media GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load this file. Try again.' },
      { status: 500 }
    );
  }
}
