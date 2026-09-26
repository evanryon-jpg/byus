export const dynamic = 'force-dynamic';

// GET /api/admin/reports
// Every content report ever submitted, newest-first within an open-first ordering --
// 'new' surfaces above everything else so the team sees unreviewed reports first, then
// 'reviewed' before the closed-out 'resolved'/'dismissed' ones. Gated by lib/admin.js's
// email allowlist, same as /api/admin/overview and /api/admin/suggestions. This is the
// enforcement side of the content guidelines in app/terms/page.js (Section 5) and of
// Stripe's own expectation that a "content creation platform" can show it's actually
// monitoring what its creators publish, not just that it has a policy.
//
// The actual query lives in lib/admin-data.js (loadAdminReports), shared with the
// /admin page's server-side initial load (app/admin/page.js).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isSupportStaff } from '@/lib/admin';
import { loadAdminReports } from '@/lib/admin-data';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

// Open to support staff as well as admins (see isSupportStaff in lib/admin.js).
export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isSupportStaff(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const reports = await loadAdminReports();
    return NextResponse.json({ reports });
  } catch (err) {
    console.error('admin/reports GET failed:', err);
    return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 });
  }
}
