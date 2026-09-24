export const dynamic = 'force-dynamic';

// POST /api/admin/support/:id -> { resolution }
// Marks a support request resolved with a short internal note. Like the appeals
// resolve route, this records the outcome only -- an actual refund still happens in
// Stripe, a cancellation through the billing portal or the admin user tools. The fan
// is not emailed automatically from here; the admin replies however the case needs.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const RESOLUTION_MAX = 1000;

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { resolution } = await request.json().catch(() => ({}));
  const trimmed = typeof resolution === 'string' ? resolution.trim().slice(0, RESOLUTION_MAX) : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'A resolution note is required.' }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE support_requests
       SET status = 'resolved', resolution = $1, resolved_at = now()
       WHERE id = $2 AND status = 'open'
       RETURNING id`,
      [trimmed, params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Request not found or already resolved.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('admin/support resolve POST failed:', err);
    return NextResponse.json({ error: 'Could not resolve this request.' }, { status: 500 });
  }
}
