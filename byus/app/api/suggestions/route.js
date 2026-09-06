export const dynamic = 'force-dynamic';

// GET  /api/suggestions -> the current user's own suggestions (creator or fan — the
// suggestion box is open to anyone with an account), newest first, including any reply
// the ByUs team left on it.
// POST /api/suggestions -> submit a new one. { message }
//
// This is the "creator suggestion box" — kept open to fans too, since a fan browsing
// the site has just as much useful perspective on layout/features as a creator running
// a page. See app/settings/page.js (SuggestionBoxCard) for where this is submitted from,
// and app/admin/page.js for where the ByUs team reads and replies to them.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

// Generous — this is a free-text idea, not a tweet, but still bounded so one submission
// can't dump an unbounded amount of text into the table or the admin view.
const MESSAGE_MAX = 2000;

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, message, status, admin_note, created_at
       FROM suggestions WHERE user_id = $1 ORDER BY created_at DESC`,
      [session.userId]
    );
    return NextResponse.json({ suggestions: result.rows });
  } catch (err) {
    console.error('suggestions GET failed:', err);
    return NextResponse.json({ error: 'Could not load your suggestions.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const rate = await checkRateLimit('suggestion', `user:${session.userId}`);
  if (!rate.success) return rateLimitResponse(rate);

  const { message } = await request.json();
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'Write a suggestion before sending.' }, { status: 400 });
  }
  if (trimmed.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Suggestions must be ${MESSAGE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    const result = await query(
      `INSERT INTO suggestions (user_id, message) VALUES ($1, $2)
       RETURNING id, message, status, admin_note, created_at`,
      [session.userId, trimmed]
    );
    return NextResponse.json({ suggestion: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('suggestions POST failed:', err);
    return NextResponse.json({ error: 'Could not send your suggestion. Try again.' }, { status: 500 });
  }
}
