export const dynamic = 'force-dynamic';

// GET  /api/creator/broadcast -> how many active subscribers an update would reach
// POST /api/creator/broadcast -> email a free-text update to every active subscriber
//
// This is deliberately the simplest possible version of "message my audience": no
// scheduling, no drafts, no per-recipient personalization beyond their creator's own
// name. It reuses the subscriber list a creator already has (same "active subscription"
// rule used everywhere else -- gated posts, live streaming) and Resend, which the app
// already sends verification/reset emails through.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { sendCreatorUpdateEmail } from '@/lib/email';

const SUBJECT_MAX = 150;
const MESSAGE_MAX = 5000;

async function loadActiveSubscriberEmails(creatorId) {
  const result = await query(
    `SELECT u.email FROM subscriptions s
     JOIN users u ON u.id = s.fan_id
     WHERE s.creator_id = $1 AND s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end > now())`,
    [creatorId]
  );
  return result.rows.map((row) => row.email).filter(Boolean);
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can do this.' }, { status: 403 });
  }

  try {
    const recipients = await loadActiveSubscriberEmails(session.userId);
    return NextResponse.json({ subscriberCount: recipients.length });
  } catch (err) {
    console.error('creator/broadcast GET failed:', err);
    return NextResponse.json({ error: 'Could not load your subscriber count.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can send updates.' }, { status: 403 });
  }

  const { subject, message } = await request.json();

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }
  if (message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message must be ${MESSAGE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }
  if (subject && subject.length > SUBJECT_MAX) {
    return NextResponse.json(
      { error: `Subject must be ${SUBJECT_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    const userResult = await query('SELECT display_name FROM users WHERE id = $1', [session.userId]);
    const creatorName = userResult.rows[0]?.display_name || 'Your creator';

    const recipients = await loadActiveSubscriberEmails(session.userId);
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "You don't have any active subscribers yet." },
        { status: 400 }
      );
    }

    const finalSubject = subject?.trim() || `Update from ${creatorName}`;
    const sent = await sendCreatorUpdateEmail(recipients, {
      creatorName,
      subject: finalSubject,
      message: message.trim(),
    });

    return NextResponse.json({ sent });
  } catch (err) {
    console.error('creator/broadcast POST failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not send this update. Try again.' },
      { status: 500 }
    );
  }
}
