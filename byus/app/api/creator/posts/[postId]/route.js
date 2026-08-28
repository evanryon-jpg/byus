export const dynamic = 'force-dynamic';

// PATCH  /api/creator/posts/:postId  -> update a post's title/body/visibility
// DELETE /api/creator/posts/:postId  -> permanently remove a post (and its media, if any)
//
// Editing swaps text and visibility only — changing the attached image is out of scope here;
// delete the post and make a new one if the media needs to change.

import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

async function loadOwnedPost(postId, userId) {
  const result = await query(`SELECT id, creator_id, media_url FROM posts WHERE id = $1`, [postId]);
  const post = result.rows[0];
  if (!post || post.creator_id !== userId) return null;
  return post;
}

export async function PATCH(request, { params }) {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can edit posts.' }, { status: 403 });
  }

  const { postId } = params;
  const { title, body, visibility } = await request.json();

  try {
    const post = await loadOwnedPost(postId, session.userId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (title !== undefined) {
      fields.push(`title = $${i++}`);
      values.push(title || null);
    }
    if (typeof body === 'string') {
      if (!body.trim()) {
        return NextResponse.json({ error: 'Post body cannot be empty.' }, { status: 400 });
      }
      fields.push(`body = $${i++}`);
      values.push(body);
    }
    if (visibility !== undefined) {
      fields.push(`visibility = $${i++}`);
      values.push(visibility === 'subscribers_only' ? 'subscribers_only' : 'public');
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    values.push(postId);
    const result = await query(
      `UPDATE posts SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, title, body, media_url, visibility, created_at`,
      values
    );

    const updated = result.rows[0];
    return NextResponse.json({
      post: { ...updated, media_url: updated.media_url ? `/api/posts/${updated.id}/media` : null },
    });
  } catch (err) {
    console.error('creator/posts PATCH failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not update this post. Try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can delete posts.' }, { status: 403 });
  }

  const { postId } = params;

  try {
    const post = await loadOwnedPost(postId, session.userId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    await query(`DELETE FROM posts WHERE id = $1`, [postId]);

    // Best-effort cleanup — an orphaned blob costs storage, not correctness, so a failure
    // here should never block the post deletion the creator actually asked for.
    if (post.media_url) {
      try {
        await del(post.media_url);
      } catch (err) {
        console.error(`Blob cleanup failed for post ${postId} (non-fatal):`, err);
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('creator/posts DELETE failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not delete this post. Try again.' },
      { status: 500 }
    );
  }
}
