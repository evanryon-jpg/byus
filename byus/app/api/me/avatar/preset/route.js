export const dynamic = 'force-dynamic';

// POST /api/me/avatar/preset
// Picks one of the built-in illustrated avatars instead of uploading a photo.
// Stores a `preset:<id>` marker in the same profile_image_url column a real
// upload would use -- app/api/avatar/[userId]/route.js knows how to tell the
// two apart and serve the right thing either way, so every other place that
// reads profile_image_url (browse, creator pages, dashboards, opengraph
// images) needs no changes at all.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { del } from '@vercel/blob';
import { isValidPresetAvatarId } from '@/lib/preset-avatars';
import { publicAvatarUrl } from '@/lib/avatar-url';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { presetId } = body || {};
  if (!isValidPresetAvatarId(presetId)) {
    return NextResponse.json({ error: 'Not a valid avatar option.' }, { status: 400 });
  }

  try {
    const existing = await query('SELECT profile_image_url FROM users WHERE id = $1', [session.userId]);
    const previous = existing.rows[0]?.profile_image_url || null;

    await query('UPDATE users SET profile_image_url = $1 WHERE id = $2', [`preset:${presetId}`, session.userId]);

    // Only a real uploaded photo has a blob behind it -- a previous preset choice
    // has nothing to clean up, and trying to del() a "preset:..." string as if it
    // were a blob pathname would just fail (harmlessly, but pointlessly).
    if (previous && !previous.startsWith('preset:')) {
      try {
        await del(previous);
      } catch (err) {
        console.error(`Old avatar cleanup failed for user ${session.userId} (non-fatal):`, err);
      }
    }

    return NextResponse.json({ profile_image_url: publicAvatarUrl(session.userId, `preset:${presetId}`) });
  } catch (err) {
    console.error('me/avatar/preset POST failed:', err);
    return NextResponse.json(
      { error: 'Could not set this avatar. Try again.' },
      { status: 500 }
    );
  }
}
