export const dynamic = 'force-dynamic';

// POST /api/fan/phone/send-code -> { phone }
// Sends a 6-digit verification code to `phone` via sent.dm. Doesn't touch
// users.phone/phone_verified_at -- that only happens once the code comes back correct
// (see ../verify/route.js) -- so a fan can try a mistyped number, request a new code
// for the right one, and nothing is left half-connected in between.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isSmsConfigured } from '@/lib/sms';
import { sendPhoneVerificationCode } from '@/lib/phone-verification';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can add a phone number for text notifications.' }, { status: 403 });
  }
  if (!isSmsConfigured()) {
    return NextResponse.json({ error: 'Text notifications are not available right now.' }, { status: 503 });
  }

  const rateCheck = await checkRateLimit('phone-verify-send', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { phone } = await request.json().catch(() => ({}));

  const result = await sendPhoneVerificationCode(session.userId, typeof phone === 'string' ? phone.trim() : '');
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
