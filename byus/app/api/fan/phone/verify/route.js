export const dynamic = 'force-dynamic';

// POST /api/fan/phone/verify -> { phone, code }
// Confirms the code sent by ../send-code/route.js and, if correct, marks this number
// verified on the account and turns new-post text notifications on -- verifying a
// number only to still be unsubscribed from what it's for would be a confusing extra
// step, so this is the one setting a fan can also flip separately in Settings
// afterward (see PATCH /api/fan/phone).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { verifyPhoneCode, isValidE164 } from '@/lib/phone-verification';
import { USER_SELECT_FIELDS, withAvatarUrl, withEffectiveFee } from '@/lib/user-profile';
import { isAdmin } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can verify a phone number.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('phone-verify-check', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { phone, code } = await request.json().catch(() => ({}));
  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  if (!isValidE164(trimmedPhone)) {
    return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
  }

  const check = await verifyPhoneCode(session.userId, trimmedPhone, code);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE users
       SET phone = $1, phone_verified_at = now(), notify_new_posts_sms = true
       WHERE id = $2
       RETURNING ${USER_SELECT_FIELDS}`,
      [trimmedPhone, session.userId]
    );
    const enriched = await withEffectiveFee(withAvatarUrl(result.rows[0]));
    return NextResponse.json({ user: { ...enriched, is_admin: isAdmin(session) } });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'That phone number is already verified on another ByUs account.' },
        { status: 409 }
      );
    }
    console.error('fan/phone/verify POST failed:', err);
    return NextResponse.json({ error: 'Could not verify that number. Try again.' }, { status: 500 });
  }
}
