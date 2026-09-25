export const dynamic = 'force-dynamic';

// GET /api/cover/:userId -- public proxy for a creator's cover banner (the Blob itself is
// private; see app/api/me/cover/route.js). Pages link here through publicCoverUrl
// (lib/avatar-url.js), which adds a version param per image, so the long immutable
// cache below is safe: a new banner always gets a new URL.

import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { query } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request, { params }) {
  const { userId } = params;
  if (!UUID_RE.test(userId || '')) {
    return NextResponse.json({ error: 'No cover image.' }, { status: 404 });
  }

  try {
    const result = await query(
      `SELECT cover_image_url FROM users WHERE id = $1 AND is_suspended = false`,
      [userId]
    );
    const pathname = result.rows[0]?.cover_image_url;
    if (!pathname) {
      return NextResponse.json({ error: 'No cover image.' }, { status: 404 });
    }

    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': blob.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('cover/[userId] GET failed:', err);
    return NextResponse.json({ error: 'Could not load this image. Try again.' }, { status: 500 });
  }
}
