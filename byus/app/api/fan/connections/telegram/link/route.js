export const dynamic = 'force-dynamic';

// POST /api/fan/connections/telegram/link
// Mints a short-lived, single-use token and returns the t.me deep link the fan clicks
// to connect their Telegram account (see app/api/webhooks/telegram/route.js for the
// /start<token> handshake that consumes it).

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isTelegramConfigured, getTelegramBotUsername } from '@/lib/telegram';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can connect Telegram.' }, { status: 403 });
  }
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: 'Telegram connect is not available right now.' }, { status: 503 });
  }

  const rateCheck = await checkRateLimit('telegram-link', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const token = crypto.randomBytes(24).toString('base64url');
  await query(
    `INSERT INTO telegram_link_tokens (token, user_id, expires_at) VALUES ($1, $2, now() + interval '15 minutes')`,
    [token, session.userId]
  );

  return NextResponse.json({ url: `https://t.me/${getTelegramBotUsername()}?start=${token}` });
}
