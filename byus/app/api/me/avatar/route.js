export const dynamic = 'force-dynamic';

// POST /api/me/avatar
// Any logged-in user (creator or fan) uploads a profile photo. The Blob
// store behind this project only allows private-access blobs (a public
// put() is rejected at the store level), so this stores the image privately
// — just like post media — and points users.profile_image_url at the
// pathname. It's served back out publicly through /api/avatar/:userId,
// which has no auth check, so the photo still ends up visible to everyone.

import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — avatars are small, no reason to allow post-sized uploads

// Map the (already-validated) content-type to a fixed extension instead of trusting
// the client-supplied filename — a filename is arbitrary attacker-controlled text and
// using it directly to build a stored pathname/extension is an injection risk.
const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// The browser-reported content-type is just a client-supplied label — nothing stops
// a request from claiming image/png while uploading an HTML file or a script. Checking
// the actual leading bytes against each format's magic number confirms the file is what
// it claims to be before we store and later serve it back out.
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

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const rateCheck = await checkRateLimit('upload', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

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

    const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!matchesMagicNumber(headerBytes, file.type)) {
      return NextResponse.json(
        { error: 'This file does not look like a valid image of the claimed type.' },
        { status: 400 }
      );
    }

    const existing = await query('SELECT profile_image_url FROM users WHERE id = $1', [session.userId]);
    const previousPathname = existing.rows[0]?.profile_image_url || null;

    const ext = EXT_BY_TYPE[file.type];
    const pathname = `avatars/${session.userId}/${crypto.randomUUID()}.${ext}`;

    const blob = await put(pathname, file, {
      access: 'private',
      contentType: file.type,
    });

    await query('UPDATE users SET profile_image_url = $1 WHERE id = $2', [blob.pathname, session.userId]);

    // Best-effort cleanup of the old avatar — an orphaned blob costs storage,
    // not correctness, so a failure here should never block the upload that
    // already succeeded.
    if (previousPathname) {
      try {
        await del(previousPathname);
      } catch (err) {
        console.error(`Old avatar cleanup failed for user ${session.userId} (non-fatal):`, err);
      }
    }

    return NextResponse.json({ profile_image_url: `/api/avatar/${session.userId}` });
  } catch (err) {
    console.error('me/avatar POST failed:', err);
    return NextResponse.json(
      { error: 'Could not upload this image. Try again.' },
      { status: 500 }
    );
  }
}
