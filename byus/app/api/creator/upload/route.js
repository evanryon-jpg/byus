export const dynamic = 'force-dynamic';

// POST /api/creator/upload
// Creators upload an image (post media, profile picture, etc). Stored in a
// private Vercel Blob store — never a public URL — so access always goes
// through our own gated routes, which enforce the subscribers-only rules.

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getCurrentUser } from '@/lib/session';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can upload files.' }, { status: 403 });
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
      return NextResponse.json({ error: 'Image must be smaller than 10MB.' }, { status: 400 });
    }

    const ext = (file.name?.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
    const pathname = `posts/${session.userId}/${crypto.randomUUID()}.${ext}`;

    const blob = await put(pathname, file, {
      access: 'private',
      contentType: file.type,
    });

    return NextResponse.json({ pathname: blob.pathname });
  } catch (err) {
    console.error('creator/upload POST failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not upload this file. Try again.' },
      { status: 500 }
    );
  }
}
