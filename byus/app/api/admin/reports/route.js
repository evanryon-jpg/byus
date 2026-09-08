export const dynamic = 'force-dynamic';

// GET /api/admin/reports
// Every content report ever submitted, newest-first within an open-first ordering --
// 'new' surfaces above everything else so the team sees unreviewed reports first, then
// 'reviewed' before the closed-out 'resolved'/'dismissed' ones. Gated by lib/admin.js's
// email allowlist, same as /api/admin/overview and /api/admin/suggestions. This is the
// enforcement side of the content guidelines in app/terms/page.js (Section 5) and of
// Stripe's own expectation that a "content creation platform" can show it's actually
// monitoring what its creators publish, not just that it has a policy.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

const STATUS_ORDER = `CASE r.status
  WHEN 'new' THEN 0
  WHEN 'reviewed' THEN 1
  WHEN 'resolved' THEN 2
  WHEN 'dismissed' THEN 3
  ELSE 4 END`;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  try {
    const result = await query(
      `SELECT r.id, r.reason, r.details, r.status, r.admin_note, r.created_at, r.updated_at,
              r.post_id, p.title AS post_title,
              reporter.id AS reporter_id, reporter.display_name AS reporter_name, reporter.email AS reporter_email,
              creator.id AS creator_id, creator.display_name AS creator_name, creator.email AS creator_email,
              creator.slug AS creator_slug
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       JOIN users creator ON creator.id = r.creator_id
       LEFT JOIN posts p ON p.id = r.post_id
       ORDER BY ${STATUS_ORDER}, r.created_at DESC`
    );
    return NextResponse.json({ reports: result.rows });
  } catch (err) {
    console.error('admin/reports GET failed:', err);
    return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 });
  }
}
