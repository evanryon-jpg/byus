export const dynamic = 'force-dynamic';

// GET /api/admin/suggestions
// Every suggestion ever submitted (creator or fan), newest-first within an open-first
// ordering — 'new' surfaces above everything else so the team sees unread ideas first,
// then 'reviewed'/'planned' before the fully closed-out 'shipped' ones. Gated by
// lib/admin.js's email allowlist, same as /api/admin/overview.
//
// The actual query lives in lib/admin-data.js (loadAdminSuggestions), shared with the
// /admin page's server-side initial load (app/admin/page.js).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { loadAdminSuggestions } from '@/lib/admin-data';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const suggestions = await loadAdminSuggestions();
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('admin/suggestions GET failed:', err);
    return NextResponse.json({ error: 'Could not load suggestions.' }, { status: 500 });
  }
}
