export const dynamic = 'force-dynamic';

// POST /api/me/avatar
// Any logged-in user (creator or fan) uploads a profile photo. Unlike
// /api/creator/upload (which stores post media privately, gated behind
// subscriber checks), this one stores the image in a PUBLIC Vercel Blob —
// avatars are meant to be visible on browse/profile pages without a login.

import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — avatars are small, no reason to allow post-sized uploads

export async function POST(request) {
  const session = getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PNG, JPEG, WEBP, or GIF images are allowed.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be smaller than 5MB.' }, { status: 400 });
    }

    const existing = await query('SELECT profile_image_url FROM users WHERE id = $1', [session.userId]);
    const previousUrl = existing.rows[0]?.profile_image_url || null;

    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().slice(0, 10);
    const pathname = `avatars/${session.userId}/${crypto.randomUUID()}.${ext}`;

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
    });

    await query('UPDATE users SET profile_image_url = $1 WHERE id = $2', [blob.url, session.userId]);

    // Best-effort cleanup of the old avatar — an orphaned blob costs storage,
    // not correctness, so a failure here should never block the upload that
    // already succeeded.
    if (previousUrl) {
      try {
        await del(previousUrl);
      } catch (err) {
        console.error(`Old avatar cleanup failed for user ${session.userId} (non-fatal):`, err);
      }
    }

    return NextResponse.json({ profile_image_url: blob.url });
  } catch (err) {
    console.error('me/avatar POST failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not upload this image. Try again.' },
      { status: 500 }
    );
  }
}
