export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { reconcilePlatformAccess } from '@/lib/platform-sync';

// Vercel calls this once a day (see vercel.json). The live Stripe-webhook-driven
// Discord/Telegram grant/revoke calls in lib/platform-sync.js are deliberately
// best-effort and never retried inline -- a rate limit, a brief outage, or the bot
// temporarily missing permissions can silently leave a fan's actual bot access out of
// sync with their subscription, with nothing else to notice or fix it. This walks every
// linked fan/creator pair, checks Discord/Telegram's own current state against what the
// subscriptions table says it should be, and repairs any drift, so a one-time hiccup is
// self-healing within a day instead of permanent -- same CRON_SECRET auth pattern as the
// other cron routes.
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('reconcile-platform-access: CRON_SECRET is not set -- refusing to run unauthenticated.');
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const summary = await reconcilePlatformAccess();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('reconcile-platform-access failed:', error);
    return NextResponse.json({ error: 'Could not reconcile platform access.' }, { status: 500 });
  }
}
