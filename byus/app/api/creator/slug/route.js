export const dynamic = 'force-dynamic';

// GET /api/creator/slug — the signed-in creator's current vanity URL (or null if unclaimed).
// PATCH /api/creator/slug — claim or change it.

import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

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

  const rateCheck = await checkRateLimit('slug-change', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

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
    await withTransaction(async (client) => {
      const current = await client.query('SELECT slug FROM users WHERE id = $1', [session.userId]);
      const previousSlug = current.rows[0]?.slug || null;

      await client.query('UPDATE users SET slug = $1 WHERE id = $2', [normalized, session.userId]);

      // This is a change to an already-claimed slug (not a first-time claim) -- keep the
      // old one pointing here so a link a creator already shared doesn't just break (see
      // database/migrations/20260919_creator_slug_history.sql and the fallback lookup in
      // lib/creator-profile-data.js). Upserted because only the most recent departure from
      // a given old slug needs remembering; if that slug is later claimed live by someone
      // else, the direct users.slug lookup always takes priority over this table anyway.
      if (previousSlug && previousSlug !== normalized) {
        await client.query(
          `INSERT INTO creator_slug_history (old_slug, user_id, replaced_at)
           VALUES ($1, $2, now())
           ON CONFLICT (old_slug) DO UPDATE SET user_id = EXCLUDED.user_id, replaced_at = now()`,
          [previousSlug, session.userId]
        );
      }
    });
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
