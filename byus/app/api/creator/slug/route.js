export const dynamic = 'force-dynamic';

// GET /api/creator/slug — the signed-in creator's current vanity URL (or null if unclaimed).
// PATCH /api/creator/slug — claim or change it.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  if (session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators have a page URL.' }, { status: 403 });
  }

  const result = await query('SELECT slug FROM users WHERE id = $1', [session.userId]);
  const slug = result.rows[0]?.slug || null;
  const { origin } = new URL(request.url);
  return NextResponse.json({
    slug,
    profileUrl: `${origin}/creator/${slug || session.userId}`,
    claimed: Boolean(slug),
  });
}

export async function PATCH(request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  if (session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can set a page URL.' }, { status: 403 });
  }

  const { slug } = await request.json();
  const normalized = (slug || '').trim().toLowerCase();

  if (!SLUG_PATTERN.test(normalized)) {
    return NextResponse.json(
      { error: '3–30 characters, lowercase letters, numbers, and hyphens only — must start and end with a letter or number.' },
      { status: 400 }
    );
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return NextResponse.json({ error: 'That URL is reserved. Try something else.' }, { status: 409 });
  }

  try {
    await query('UPDATE users SET slug = $1 WHERE id = $2', [normalized, session.userId]);
    const { origin } = new URL(request.url);
    return NextResponse.json({ slug: normalized, profileUrl: `${origin}/creator/${normalized}`, claimed: true });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'That URL is already taken.' }, { status: 409 });
    }
    console.error('slug update failed:', err);
    return NextResponse.json({ error: 'Could not update your page URL. Try again.' }, { status: 500 });
  }
}
