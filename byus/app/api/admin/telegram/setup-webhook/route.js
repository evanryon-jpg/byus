export const dynamic = 'force-dynamic';

// GET or POST /api/admin/telegram/setup-webhook
// One-time (or re-run-anytime) admin action: tells Telegram where to deliver bot
// updates. Only needs running once after TELEGRAM_BOT_TOKEN is first set, or again if
// the bot's ever recreated -- Telegram remembers the webhook URL until changed.
// Answers GET too (not just POST) so it can just be visited directly in a browser
// while signed in as admin, rather than needing a dedicated UI button for a
// one-off/rarely-repeated action -- registering a webhook URL is idempotent and has
// no side effect beyond telling Telegram where to send updates, so this is safe to
// expose as a plain navigable link, unlike most other admin POST actions in this app.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { isTelegramConfigured, setTelegramWebhook } from '@/lib/telegram';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

async function handle(request) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set.' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || process.env.APP_URL;
  const webhookUrl = `${origin}/api/webhooks/telegram`;

  try {
    await setTelegramWebhook(webhookUrl);
    return NextResponse.json({ ok: true, webhookUrl });
  } catch (err) {
    console.error('Telegram setWebhook failed:', err);
    return NextResponse.json({ error: err.message || 'Could not register the Telegram webhook.' }, { status: 500 });
  }
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
