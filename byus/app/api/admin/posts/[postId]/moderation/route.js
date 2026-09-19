export const dynamic = 'force-dynamic';

// POST /api/admin/posts/:postId/moderation
// Approves or rejects one pending video. This is deliberately per-post: clearing a
// creator's account review never grants a blanket pass to future videos.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { deleteAsset } from '@/lib/mux';

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { postId } = params;
  const { action } = await request.json().catch(() => ({}));
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT p.id, p.pending_review, p.mux_asset_id, p.mux_playback_id,
              u.review_cleared_at
       FROM posts p
       JOIN users u ON u.id = p.creator_id
       WHERE p.id = $1`,
      [postId]
    );
    const post = result.rows[0];

    if (!post || !post.mux_playback_id) {
      return NextResponse.json({ error: 'Video post not found.' }, { status: 404 });
    }
    if (!post.pending_review) {
      return NextResponse.json({ error: 'This video has already been reviewed.' }, { status: 409 });
    }

    if (action === 'approve') {
      if (!post.review_cleared_at) {
        return NextResponse.json(
          { error: 'Clear the creator account review before approving this video.' },
          { status: 409 }
        );
      }
      await query('UPDATE posts SET pending_review = false WHERE id = $1', [postId]);
      return NextResponse.json({ approved: true });
    }

    // Rejection removes both the hidden post and its stored Mux asset. The database
    // deletion is authoritative; Mux cleanup is best-effort so a provider hiccup
    // cannot accidentally make rejected content visible.
    await query('DELETE FROM posts WHERE id = $1', [postId]);
    if (post.mux_asset_id) {
      try {
        await deleteAsset(post.mux_asset_id);
      } catch (err) {
        console.error(`Rejected-video Mux cleanup failed for post ${postId}:`, err);
      }
    }

    return NextResponse.json({ rejected: true });
  } catch (err) {
    console.error('admin video moderation failed:', err);
    return NextResponse.json(
      { error: 'Could not complete video moderation. Try again.' },
      { status: 500 }
    );
  }
}
