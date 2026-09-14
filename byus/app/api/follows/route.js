import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Log in to follow creators.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const creatorId = String(body.creatorId || '');
  const shouldFollow = body.following !== false;
  if (!/^[0-9a-f-]{36}$/i.test(creatorId)) {
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
    await query(
      'INSERT INTO creator_follows (fan_id, creator_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [session.userId, creatorId]
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
