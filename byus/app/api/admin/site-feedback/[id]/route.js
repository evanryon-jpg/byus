export const dynamic = 'force-dynamic';

// PATCH /api/admin/site-feedback/:id -- marks one visitor feedback row reviewed (or
// back to new). Admin-only triage, same shape as the suggestions/reports status toggle.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { query } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['new', 'reviewed']);

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid feedback entry.' }, { status: 400 });
  }

  const { status } = await request.json().catch(() => ({}));
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: 'Choose a valid status.' }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE site_feedback SET status = $1 WHERE id = $2 RETURNING id, reaction, message, page_path, status, created_at`,
      [status, params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Feedback entry not found.' }, { status: 404 });
    }
    return NextResponse.json({ feedback: result.rows[0] });
  } catch (err) {
    console.error('admin/site-feedback PATCH failed:', err);
    return NextResponse.json({ error: 'Could not update that entry.' }, { status: 500 });
  }
}
