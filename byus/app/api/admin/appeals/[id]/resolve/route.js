export const dynamic = 'force-dynamic';

// POST /api/admin/appeals/:id/resolve -> { resolution, reinstated? }
// Marks a suspension appeal resolved with a short internal note on why. Deliberately
// does NOT itself touch is_suspended or the Stripe side of a suspension — that's the
// existing, already-tested PATCH /api/admin/users/[id] route (payout/subscription
// pause+resume and all). The admin appeals page calls that route first when the admin
// chooses "Reinstate & resolve", then calls this one to record the appeal's outcome —
// two calls from the client rather than duplicating the reinstatement logic here.
// Gated by lib/admin.js's email allowlist, same as the rest of /api/admin.

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

  const { resolution, reinstated } = await request.json().catch(() => ({}));
  const trimmedResolution = typeof resolution === 'string' ? resolution.trim().slice(0, RESOLUTION_MAX) : '';
  if (!trimmedResolution) {
    return NextResponse.json({ error: 'A resolution note is required.' }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE suspension_appeals
       SET status = 'resolved', resolution = $1, reinstated = $2, resolved_at = now()
       WHERE id = $3 AND status = 'open'
       RETURNING id`,
      [trimmedResolution, Boolean(reinstated), params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Appeal not found or already resolved.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('admin/appeals resolve POST failed:', err);
    return NextResponse.json({ error: 'Could not resolve this appeal.' }, { status: 500 });
  }
}
