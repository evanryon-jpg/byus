import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { supporterSourceFromRequest } from '@/lib/supporter-source';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Log in to view follows.' }, { status: 401 });

  const result = await query(
    `SELECT u.id, u.display_name, u.slug, u.bio, u.profile_image_url, f.created_at
     FROM creator_follows f
     JOIN users u ON u.id = f.creator_id
     WHERE f.fan_id = $1 AND u.role = 'creator' AND u.is_suspended = false
     ORDER BY f.created_at DESC
     LIMIT 200`,
    [session.userId]
  );

  return NextResponse.json({
    creators: result.rows.map((creator) => ({
      id: creator.id,
      display_name: creator.display_name,
      slug: creator.slug,
      bio: creator.bio,
      profile_image_url: creator.profile_image_url ? `/api/avatar/${creator.id}` : null,
      followed_at: creator.created_at,
    })),
  });
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Log in to follow creators.' }, { status: 401 });

  const rate = await checkRateLimit('follow', `user:${session.userId}`);
  if (!rate.success) return rateLimitResponse(rate);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const creatorId = String(body.creatorId || '');
  const shouldFollow = body.following !== false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creatorId)) {
    return NextResponse.json({ error: 'Invalid creator.' }, { status: 400 });
  }
  if (creatorId === session.userId) {
    return NextResponse.json({ error: 'You cannot follow your own page.' }, { status: 400 });
  }

  const creator = await query(
    "SELECT id FROM users WHERE id = $1 AND role = 'creator' AND is_suspended = false",
    [creatorId]
  );
  if (!creator.rows[0]) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

  if (shouldFollow) {
    // supporter_source: how this fan first found the creator (lib/supporter-source.js).
    await query(
      'INSERT INTO creator_follows (fan_id, creator_id, supporter_source) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [session.userId, creatorId, supporterSourceFromRequest(request, creatorId)]
    );
  } else {
    await query('DELETE FROM creator_follows WHERE fan_id = $1 AND creator_id = $2', [
      session.userId,
      creatorId,
    ]);
  }

  const count = await query(
    'SELECT COUNT(*)::int AS count FROM creator_follows WHERE creator_id = $1',
    [creatorId]
  );
  return NextResponse.json({ following: shouldFollow, followerCount: count.rows[0].count });
}
