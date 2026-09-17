export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const ALLOWED_CAMPAIGNS = new Set(['instagram', 'blogger']);
const ALLOWED_EVENTS = new Set(['view', 'demo_click', 'browse_click', 'feedback_click', 'signup_click']);

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const campaign = typeof body.campaign === 'string' ? body.campaign : '';
  const event = typeof body.event === 'string' ? body.event : '';

  if (!ALLOWED_CAMPAIGNS.has(campaign) || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: 'Invalid campaign metric.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit('campaign-metric', `ip:${ip}`);
  if (!limit.success) {
    // Metrics are best-effort and must never interrupt navigation or show visitors an
    // error. A limited event is simply ignored.
    return new NextResponse(null, { status: 204 });
  }

  try {
    await query(
      `INSERT INTO campaign_metrics (day, campaign, event, event_count)
       VALUES (CURRENT_DATE, $1, $2, 1)
       ON CONFLICT (day, campaign, event)
       DO UPDATE SET event_count = campaign_metrics.event_count + 1`,
      [campaign, event]
    );
  } catch (err) {
    console.error('campaign metric write failed:', err);
  }

  return new NextResponse(null, { status: 204 });
}
