export const dynamic = 'force-dynamic';

// POST /api/fan/feed-token
// Issues (or regenerates) the calling fan's private podcast/RSS feed link for one
// creator they're subscribed to -- see database/migrations/20260918_fan_feed_tokens.sql
// and app/api/feed/[token]/route.js for the feed itself. Session-gated like any other
// fan-side route; the resulting token is what carries access from here on, since a
// podcast app has no session cookie of its own.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { generateFeedToken } from '@/lib/feed-token';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can get a feed link.' }, { status: 403 });
  }

  const rateLimitResult = await checkRateLimit('feed-token', `user:${session.userId}`);
  if (!rateLimitResult.success) return rateLimitResponse(rateLimitResult);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const creatorId = typeof body?.creatorId === 'string' ? body.creatorId : null;
  const regenerate = Boolean(body?.regenerate);
  if (!creatorId) {
    return NextResponse.json({ error: 'creatorId is required.' }, { status: 400 });
  }

  try {
    // A feed link only makes sense for a creator this fan actually has access to --
    // same active-subscription check used everywhere else in this app. Without this,
    // anyone could mint a feed link for any creator ID and use it to probe whether a
    // subscribers-only post exists, even with zero actual access.
    const subResult = await query(
      `SELECT id FROM subscriptions
       WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
         AND (current_period_end IS NULL OR current_period_end > now())
       LIMIT 1`,
      [session.userId, creatorId]
    );
    if (subResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'You need an active subscription to this creator to get a feed link.' },
        { status: 403 }
      );
    }

    let token;
    if (regenerate) {
      // Overwrite in place -- this immediately invalidates whatever URL was issued
      // before (e.g. one that leaked or was shared by mistake) without touching this
      // fan's feed link for any other creator.
      token = generateFeedToken();
      await query(
        `INSERT INTO fan_feed_tokens (fan_id, creator_id, token)
         VALUES ($1, $2, $3)
         ON CONFLICT (fan_id, creator_id) DO UPDATE SET token = EXCLUDED.token, created_at = now()`,
        [session.userId, creatorId, token]
      );
    } else {
      // Idempotent "get or create" -- a plain "copy my feed link" click should never
      // silently rotate an already-issued link out from under whatever podcast app
      // already has it saved.
      const existing = await query(
        `SELECT token FROM fan_feed_tokens WHERE fan_id = $1 AND creator_id = $2`,
        [session.userId, creatorId]
      );
      if (existing.rows.length > 0) {
        token = existing.rows[0].token;
      } else {
        token = generateFeedToken();
        await query(
          `INSERT INTO fan_feed_tokens (fan_id, creator_id, token) VALUES ($1, $2, $3)
           ON CONFLICT (fan_id, creator_id) DO NOTHING`,
          [session.userId, creatorId, token]
        );
        // Extremely unlikely (token collision) or a concurrent request won the
        // upsert first -- either way, read back whatever row actually landed rather
        // than assuming it was ours.
        const landed = await query(
          `SELECT token FROM fan_feed_tokens WHERE fan_id = $1 AND creator_id = $2`,
          [session.userId, creatorId]
        );
        token = landed.rows[0]?.token || token;
      }
    }

    const origin = request.headers.get('origin') || process.env.APP_URL || 'https://byusapp.com';
    return NextResponse.json({ url: `${origin}/api/feed/${token}` });
  } catch (err) {
    console.error('fan/feed-token POST failed:', err);
    return NextResponse.json(
      { error: 'Could not create your feed link. Try again.' },
      { status: 500 }
    );
  }
}
