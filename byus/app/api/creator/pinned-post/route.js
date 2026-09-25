export const dynamic = 'force-dynamic';

// POST /api/creator/pinned-post  { postId: string | null }
// Pins one of the creator's own public posts to the top of their page as a "Start here"
// intro (usually a welcome video), or unpins with postId: null. Only public posts can be
// pinned -- an intro a visitor can't open would defeat the point. If a pinned post is
// later made subscribers-only, the profile page simply stops showing it as pinned
// (lib/creator-profile-data.js); deleting it clears the pin (ON DELETE SET NULL).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can pin posts.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('post-modify', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  let postId = null;
  try {
    ({ postId = null } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    if (postId === null) {
      await query('UPDATE users SET pinned_post_id = NULL WHERE id = $1', [session.userId]);
      return NextResponse.json({ pinnedPostId: null });
    }

    if (typeof postId !== 'string' || !UUID_RE.test(postId)) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    const result = await query(
      'SELECT id, visibility FROM posts WHERE id = $1 AND creator_id = $2',
      [postId, session.userId]
    );
    const post = result.rows[0];
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    if (post.visibility !== 'public') {
      return NextResponse.json(
        { error: 'Only public posts can be pinned, so every visitor can see your intro. Make this post public first.' },
        { status: 400 }
      );
    }

    await query('UPDATE users SET pinned_post_id = $1 WHERE id = $2', [post.id, session.userId]);
    return NextResponse.json({ pinnedPostId: post.id });
  } catch (err) {
    console.error('creator/pinned-post POST failed:', err);
    return NextResponse.json({ error: 'Could not update your pinned post. Try again.' }, { status: 500 });
  }
}
