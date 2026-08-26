export const dynamic = 'force-dynamic';

// GET  /api/creator/posts   -> list the logged-in creator's own posts (all of them, own view)
// POST /api/creator/posts   -> create a new post, public or subscribers-only

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view this.' }, { status: 403 });
  }

  const result = await query(
    `SELECT id, title, body, media_url, visibility, created_at
     FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
    [session.userId]
  );
  return NextResponse.json({ posts: result.rows });
}

export async function POST(request) {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can post.' }, { status: 403 });
  }

  const { title, body, mediaUrl, visibility } = await request.json();

  if (!body) {
    return NextResponse.json({ error: 'Post body is required.' }, { status: 400 });
  }
  const finalVisibility = visibility === 'subscribers_only' ? 'subscribers_only' : 'public';

  const result = await query(
    `INSERT INTO posts (creator_id, title, body, media_url, visibility)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, body, media_url, visibility, created_at`,
    [session.userId, title || null, body, mediaUrl || null, finalVisibility]
  );

  return NextResponse.json({ post: result.rows[0] });
}
