export const dynamic = 'force-dynamic';

// GET /api/admin/compliance
// A live snapshot of ByUs's enforcement posture — suspensions, appeals, legal-acceptance
// coverage, open content reports, pending video review, open payment disputes. Built so
// the next processor compliance question is "here's a live page" instead of a fresh
// email written from scratch. See lib/admin-data.js (loadComplianceSnapshot) for the
// underlying queries. Gated by lib/admin.js's email allowlist, same as the rest of
// /api/admin.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { loadComplianceSnapshot } from '@/lib/admin-data';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const snapshot = await loadComplianceSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('admin/compliance GET failed:', err);
    return NextResponse.json({ error: 'Could not load the compliance snapshot.' }, { status: 500 });
  }
}
