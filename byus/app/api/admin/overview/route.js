export const dynamic = 'force-dynamic';

// GET /api/admin/overview
// Platform-wide numbers for the owner: what ByUs itself has earned (not just what
// creators have earned), how many creators/fans have signed up, active subscriptions,
// a 12-month trailing series for the dashboard's charts, and a recent-creators list for
// spotting problem accounts (never onboarded Stripe, zero earnings after weeks, etc).
// Gated by lib/admin.js's email allowlist rather than the `role` column — see that file
// for why.
//
// The actual query logic lives in lib/admin-data.js (loadAdminOverview), shared with
// the /admin page's server-side initial load (app/admin/page.js) so the two can't
// report different numbers.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { loadAdminOverview } from '@/lib/admin-data';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const overview = await loadAdminOverview();
    return NextResponse.json(overview);
  } catch (err) {
    console.error('admin/overview GET failed:', err);
    return NextResponse.json({ error: 'Could not load platform overview.' }, { status: 500 });
  }
}
