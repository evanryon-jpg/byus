export const dynamic = 'force-dynamic';

// POST /api/reports -> { creatorId, postId?, reason, details? }
// Lets any logged-in fan or creator flag a creator's page, or a specific post on it, for
// review by the ByUs team. This is the enforcement half of the content guidelines in
// app/terms/page.js (Section 5) -- a policy that bans adult content but has no way for
// anyone to flag it isn't actually enforceable. See app/api/admin/reports/route.js and
// app/api/admin/reports/[id]/route.js for where the ByUs team reviews these, and
// app/creator/[creatorId]/page.js's ReportButton for the submitter-facing side.
//
// Requires login (same call as /api/suggestions) -- cuts down on drive-by spam without
// needing a CAPTCHA, at the cost of an anonymous visitor not being able to report. Given
// ByUs's actual scale today and that every fan already needs an account to subscribe
// anyway, that trade is worth it for now.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const VALID_REASONS = new Set(['adult_content', 'illegal_content', 'harassment', 'ip_infringement', 'other']);
const DETAILS_MAX = 1000;

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Log in to submit a report.' }, { status: 401 });
  }

  const rate = await checkRateLimit('report', `user:${session.userId}`);
  if (!rate.success) return rateLimitResponse(rate);

  const { creatorId, postId, reason, details } = await request.json();

  if (typeof creatorId !== 'string' || !creatorId) {
    return NextResponse.json({ error: 'Missing creator.' }, { status: 400 });
  }
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: 'Choose a reason for this report.' }, { status: 400 });
  }
  if (creatorId === session.userId) {
    return NextResponse.json({ error: "You can't report your own page." }, { status: 400 });
  }
  const trimmedDetails = typeof details === 'string' ? details.trim() : '';
  if (trimmedDetails.length > DETAILS_MAX) {
    return NextResponse.json({ error: `Details must be ${DETAILS_MAX} characters or fewer.` }, { status: 400 });
  }

  try {
    // Confirm the creator actually exists (and is a creator) before writing a row that
    // references it -- the FK would catch a bogus id anyway, but this gives a clean 404
    // instead of a raw constraint-violation 500.
    const creatorResult = await query(`SELECT id FROM users WHERE id = $1 AND role = 'creator'`, [creatorId]);
    if (creatorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }

    // If a specific post was flagged, confirm it actually belongs to this creator --
    // otherwise a client could attach an unrelated post's id to a report about someone
    // else entirely.
    let validPostId = null;
    if (typeof postId === 'string' && postId) {
      const postResult = await query(`SELECT id FROM posts WHERE id = $1 AND creator_id = $2`, [postId, creatorId]);
      if (postResult.rows.length === 0) {
        return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
      }
      validPostId = postId;
    }

    const result = await query(
      `INSERT INTO reports (reporter_id, creator_id, post_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [session.userId, creatorId, validPostId, reason, trimmedDetails || null]
    );
    return NextResponse.json({ report: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('reports POST failed:', err);
    return NextResponse.json({ error: 'Could not send your report. Try again.' }, { status: 500 });
  }
}
