export const dynamic = 'force-dynamic';

// GET /api/avatar/:userId
// Streams a user's profile photo out of private Blob storage. Unlike post
// media, this is intentionally open to everyone, logged in or not — avatars
// are meant to be publicly visible on browse/profile pages. The Vercel Blob
// store behind this project only allows private-access blobs, so avatars are
// uploaded privately (see /api/me/avatar) and served back out through this
// unauthenticated proxy instead of a direct public URL.

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

    // A preset avatar isn't in Blob storage at all -- it's one of the static
    // illustrations in public/images/avatars -- so send the browser straight
    // there instead of trying to look it up as a blob pathname.
    if (pathname.startsWith('preset:')) {
      const id = pathname.slice('preset:'.length);
      if (!isValidPresetAvatarId(id)) {
        return NextResponse.json({ error: 'No profile photo.' }, { status: 404 });
      }
      return NextResponse.redirect(new URL(`/images/avatars/${id}.svg`, request.url));
    }

    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': blob.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        // Short public cache — long enough to avoid re-fetching on every page
        // view, short enough that a changed avatar shows up quickly since the
        // URL doesn't change when the photo does.
        'Cache-Control': 'public, max-age=60',
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
