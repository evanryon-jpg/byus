export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { query } from '@/lib/db';
import { isValidPresetAvatarId } from '@/lib/preset-avatars';

export async function GET(request, { params }) {
  const { userId } = params;

  try {
    const result = await query('SELECT profile_image_url FROM users WHERE id = $1', [userId]);
    const pathname = result.rows[0]?.profile_image_url;
    if (!pathname) {
      return NextResponse.json({ error: 'No profile photo.' }, { status: 404 });
    }

    if (pathname.startsWith('preset:')) {
      const id = pathname.slice('preset:'.length);
      if (!isValidPresetAvatarId(id)) {
        return NextResponse.json({ error: 'No profile photo.' }, { status: 404 });
      }
      return NextResponse.redirect(new URL(`/api/preset-avatar/${id}`, request.url));
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
    console.error('avatar/[userId] GET failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not load this image. Try again.' },
      { status: 500 }
    );
  }
}
