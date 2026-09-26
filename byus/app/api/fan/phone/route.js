export const dynamic = 'force-dynamic';

// PATCH /api/fan/phone -> { notify_new_posts_sms } -- toggle text notifications for an
// already-verified number.
// DELETE /api/fan/phone -> unlinks the number entirely (clears phone, phone_verified_at,
// and notify_new_posts_sms), the same "start over" escape hatch
// app/api/fan/connections/[provider]/route.js gives Discord/Telegram.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { USER_SELECT_FIELDS, withAvatarUrl, withEffectiveFee } from '@/lib/user-profile';
import { staffFlags } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

async function respondWithUser(session, row) {
  const enriched = await withEffectiveFee(withAvatarUrl(row));
  return NextResponse.json({ user: { ...enriched, ...staffFlags(session) } });
}

export async function PATCH(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans have text notification settings.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('me-update', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { notify_new_posts_sms } = await request.json().catch(() => ({}));
  if (notify_new_posts_sms === undefined) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE users
       SET notify_new_posts_sms = $1
       WHERE id = $2 AND phone_verified_at IS NOT NULL
       RETURNING ${USER_SELECT_FIELDS}`,
      [Boolean(notify_new_posts_sms), session.userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Verify a phone number before turning this on.' }, { status: 400 });
    }
    return await respondWithUser(session, result.rows[0]);
  } catch (err) {
    console.error('fan/phone PATCH failed:', err);
    return NextResponse.json({ error: 'Could not save this setting.' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans have a phone number to remove.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('me-update', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const result = await query(
      `UPDATE users
       SET phone = NULL, phone_verified_at = NULL, notify_new_posts_sms = false
       WHERE id = $1
       RETURNING ${USER_SELECT_FIELDS}`,
      [session.userId]
    );
    return await respondWithUser(session, result.rows[0]);
  } catch (err) {
    console.error('fan/phone DELETE failed:', err);
    return NextResponse.json({ error: 'Could not remove that number.' }, { status: 500 });
  }
}
