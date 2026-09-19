export const dynamic = 'force-dynamic';

// GET /api/admin/sms-holds
// Backs client-side refreshes on /admin after an approve/reject action -- the initial
// list is server-rendered the same way admin_tasks is (see lib/admin-data.js's
// loadPendingSmsBroadcastHolds, called from app/admin/page.js). Gated by the same
// lib/admin.js email allowlist as the rest of /api/admin.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { listPendingSmsBroadcastHolds } from '@/lib/sms-holds';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    return NextResponse.json({ holds: await listPendingSmsBroadcastHolds() });
  } catch (err) {
    console.error('admin/sms-holds GET failed:', err);
    return NextResponse.json({ error: 'Could not load pending SMS sends.' }, { status: 500 });
  }
}
