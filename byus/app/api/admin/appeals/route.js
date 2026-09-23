export const dynamic = 'force-dynamic';

// GET /api/admin/appeals
// Every suspension appeal ever submitted via app/appeal/page.js, open-first ordering.
// The actual query lives in lib/admin-data.js (loadSuspensionAppeals), same pattern as
// /api/admin/reports and /api/admin/suggestions. Gated by lib/admin.js's email
// allowlist, same as the rest of /api/admin.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { loadSuspensionAppeals } from '@/lib/admin-data';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const appeals = await loadSuspensionAppeals();
    return NextResponse.json({ appeals });
  } catch (err) {
    console.error('admin/appeals GET failed:', err);
    return NextResponse.json({ error: 'Could not load appeals.' }, { status: 500 });
  }
}
