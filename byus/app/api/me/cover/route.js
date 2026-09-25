export const dynamic = 'force-dynamic';

// POST   /api/me/cover  -> a creator uploads the banner image across the top of their page
// DELETE /api/me/cover  -> removes it
//
// Same storage model as the profile photo (app/api/me/avatar/route.js): the Blob store
// only allows private blobs, so the pathname goes in users.cover_image_url and the image
// is served back out publicly through /api/cover/:userId.

import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { publicCoverUrl } from '@/lib/avatar-url';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024; // a wide banner photo is bigger than an avatar
const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Confirms the file's leading bytes match the type it claims (copied from the avatar route).
function matchesMagicNumber(bytes, type) {
  const b = bytes;
  switch (type) {
    case 'image/png':
      return (
        b.length >= 8 &&
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
        b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
      );
    case 'image/jpeg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/gif':
      return (
        b.length >= 6 &&
        b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
        (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
      );
    case 'image/webp':
      return (
        b.length >= 12 &&
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
      );
    default:
      return false;
  }
}

async function requireCreator() {
  const session = await getCurrentUser();
  if (!session) return { error: NextResponse.json({ error: 'Not logged in.' }, { status: 401 }) };
  if (session.role !== 'creator') {
    return { error: NextResponse.json({ error: 'Only creators have a cover image.' }, { status: 403 }) };
  }
  return { session };
}

async function deleteBlobQuietly(pathname, userId) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch (err) {
    console.error(`Cover blob cleanup failed for user ${userId} (non-fatal):`, err);
  }
}

export async function POST(request) {
  const { session, error } = await requireCreator();
  if (error) return error;

  const rateCheck = await checkRateLimit('upload', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Use a PNG, JPEG, or WEBP image.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be smaller than 8MB.' }, { status: 400 });
    }
    const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!matchesMagicNumber(headerBytes, file.type)) {
      return NextResponse.json(
        { error: 'This file does not look like a valid image of the claimed type.' },
        { status: 400 }
      );
    }

    const existing = await query('SELECT cover_image_url FROM users WHERE id = $1', [session.userId]);
    const previousPathname = existing.rows[0]?.cover_image_url || null;

    const pathname = `covers/${session.userId}/${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;
    const blob = await put(pathname, file, { access: 'private', contentType: file.type });
    await query('UPDATE users SET cover_image_url = $1 WHERE id = $2', [blob.pathname, session.userId]);
    await deleteBlobQuietly(previousPathname, session.userId);

    return NextResponse.json({ cover_image_url: publicCoverUrl(session.userId, blob.pathname) });
  } catch (err) {
    console.error('me/cover POST failed:', err);
    return NextResponse.json({ error: 'Could not upload this image. Try again.' }, { status: 500 });
  }
}

export async function DELETE() {
  const { session, error } = await requireCreator();
  if (error) return error;

  try {
    const existing = await query('SELECT cover_image_url FROM users WHERE id = $1', [session.userId]);
    const pathname = existing.rows[0]?.cover_image_url || null;
    if (pathname) {
      await query('UPDATE users SET cover_image_url = NULL WHERE id = $1', [session.userId]);
      await deleteBlobQuietly(pathname, session.userId);
    }
    return NextResponse.json({ cover_image_url: null });
  } catch (err) {
    console.error('me/cover DELETE failed:', err);
    return NextResponse.json({ error: 'Could not remove this image. Try again.' }, { status: 500 });
  }
}
