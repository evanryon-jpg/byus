export const dynamic = 'force-dynamic';

// GET /api/admin/risk
// Recent medium/high-risk checkout attempts (last 30 days) plus 24h counts, from
// lib/risk-score.js's checkout_risk_events table. Read-only: the score is advisory and
// nothing here blocks or refunds anything -- an admin who sees a pattern acts on it
// through the existing tools (suspend the account from /admin, refund in Stripe).
// Gated by lib/admin.js's email allowlist, same as the rest of /api/admin.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { loadRecentRiskEvents, countRiskEvents } from '@/lib/risk-score';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const [events, last24h, last7d] = await Promise.all([
      loadRecentRiskEvents({ days: 30, limit: 100 }),
      countRiskEvents({ hours: 24 }),
      countRiskEvents({ hours: 24 * 7 }),
    ]);
    return NextResponse.json({ events, last24h, last7d });
  } catch (err) {
    console.error('admin/risk GET failed:', err);
    return NextResponse.json({ error: 'Could not load risk events.' }, { status: 500 });
  }
}
