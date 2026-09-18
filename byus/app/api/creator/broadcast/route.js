export const dynamic = 'force-dynamic';
// Headroom above INLINE_BUDGET_MS (8s) below for the subscriber-list query, the job's
// recipient-row insert, and the chunk sends themselves -- comfortably under Vercel's
// configurable ceiling on the Pro plan this project runs on.
export const maxDuration = 30;

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
import { containsBlockedContent } from '@/lib/content-policy';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createBroadcastJob, processBroadcastJobChunk, getBroadcastJobStatus } from '@/lib/broadcast-jobs';

// How long the initiating request itself spends sending chunks before it hands the
// rest to the cron worker (app/api/cron/process-broadcasts/route.js). Short enough to
// stay well clear of Vercel's default function timeout, generous enough that a typical
// creator's subscriber count (well under a thousand today) still finishes -- and the
// creator sees "Sent to N subscribers" -- inline, in this same request, same as before
// this job system existed.
const INLINE_BUDGET_MS = 8000;

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

  const rateCheck = await checkRateLimit('broadcast', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

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
  // Same structural content gate applied to bio, tier text, links, and post title/body
  // (see lib/content-policy.js) -- this free-text update reaches every active subscriber's
  // inbox exactly like a post would, so it needs the same check before it goes out.
  const broadcastPolicyCheck = containsBlockedContent(subject, message);
  if (broadcastPolicyCheck.blocked) {
    return NextResponse.json(
      { error: `That update ${broadcastPolicyCheck.message}.` },
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

    // Queues every recipient as a row the job can resume from, then processes chunks
    // inline for up to INLINE_BUDGET_MS -- a normal-sized subscriber list finishes
    // right here and this looks identical to the old synchronous response. Anything
    // left after the budget runs out (a subscriber base large enough that sending to
    // everyone can't fit in one request) is picked up by the cron worker a chunk at a
    // time until it's done -- see lib/broadcast-jobs.js.
    const jobId = await createBroadcastJob({
      creatorId: session.userId,
      creatorName,
      subject: finalSubject,
      message: message.trim(),
      recipients,
    });
    await processBroadcastJobChunk(jobId, { budgetMs: INLINE_BUDGET_MS });
    const status = await getBroadcastJobStatus(jobId);

    return NextResponse.json({
      sent: status.sent,
      failed: status.failed,
      total: status.total,
      status: status.status,
      jobId,
    });
  } catch (err) {
    console.error('creator/broadcast POST failed:', err);
    return NextResponse.json(
      { error: 'Could not send this update. Try again.' },
      { status: 500 }
    );
  }
}
