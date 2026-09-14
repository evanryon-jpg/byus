export const dynamic = 'force-dynamic';

// POST /api/feedback
// Anonymous "what do you think of this page?" widget (see app/components/FeedbackWidget.jsx),
// shown as a floating tab near the top of the homepage. { reaction?, message?, pagePath?, website }
//
// Deliberately separate from /api/suggestions: that one requires a logged-in creator or
// fan and is meant for product ideas from people already using ByUs. This one is for a
// first-time visitor's gut reaction to the page itself, before they've signed up for
// anything -- so no session, no account, just a reaction and/or a short note.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

const MESSAGE_MAX = 500;
const PAGE_PATH_MAX = 200;
const REACTIONS = new Set(['up', 'down']);

export async function POST(request) {
  const { reaction, message, pagePath, website } = await request.json().catch(() => ({}));

  // --- Honeypot --- same pattern as /api/waitlist: respond like a normal success so a
  // bot filling every field it can find never learns which one was the trap.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  const cleanReaction = REACTIONS.has(reaction) ? reaction : null;
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (trimmedMessage.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Feedback must be ${MESSAGE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }
  if (!cleanReaction && !trimmedMessage) {
    return NextResponse.json({ error: 'Pick a reaction or add a note before sending.' }, { status: 400 });
  }
  const cleanPagePath =
    typeof pagePath === 'string' && pagePath.startsWith('/') ? pagePath.trim().slice(0, PAGE_PATH_MAX) : null;

  const ip = getClientIp(request);
  const rateCheck = await checkRateLimit('feedback', `ip:${ip}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    await query(
      `INSERT INTO site_feedback (reaction, message, page_path) VALUES ($1, $2, $3)`,
      [cleanReaction, trimmedMessage || null, cleanPagePath]
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('feedback POST failed:', err);
    return NextResponse.json({ error: 'Could not send your feedback. Try again.' }, { status: 500 });
  }
}
