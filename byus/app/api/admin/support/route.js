export const dynamic = 'force-dynamic';

// GET /api/admin/support
// Support requests the fan help assistant escalated to a human (see
// app/api/fan/assistant/route.js), open first. Each carries the assistant's one-line
// summary plus the chat transcript that led to it, so the admin has the full context
// without asking the fan to repeat themselves. Gated by lib/admin.js's allowlist.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isSupportStaff } from '@/lib/admin';
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
    const result = await query(
      `SELECT r.id, r.kind, r.summary, r.transcript, r.status, r.resolution, r.resolved_at, r.created_at,
              u.id AS user_id, u.display_name AS user_name, u.email AS user_email
       FROM support_requests r
       JOIN users u ON u.id = r.user_id
       ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END,
                CASE WHEN r.status = 'open' THEN r.created_at END ASC,
                CASE WHEN r.status != 'open' THEN r.created_at END DESC
       LIMIT 200`
    );
    return NextResponse.json({ requests: result.rows });
  } catch (err) {
    console.error('admin/support GET failed:', err);
    return NextResponse.json({ error: 'Could not load support requests.' }, { status: 500 });
  }
}
