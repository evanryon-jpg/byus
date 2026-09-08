export const dynamic = 'force-dynamic';

// PATCH /api/admin/reports/[id] -> { status?, admin_note? }
// Lets the ByUs team triage a report (move it through new -> reviewed -> resolved, or
// dismissed for a report that turns out not to violate anything) and leave a short
// internal note on what was found/done. Gated the same way as the rest of /api/admin.
// See app/api/admin/suggestions/[id]/route.js for the near-identical pattern this
// mirrors -- the two are unrelated features but the same shape of "triage a queue" UI.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

const VALID_STATUSES = new Set(['new', 'reviewed', 'resolved', 'dismissed']);
const ADMIN_NOTE_MAX = 1000;

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { status, admin_note } = await request.json();

  const fields = [];
  const values = [];
  let i = 1;

  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }
    fields.push(`status = $${i++}`);
    values.push(status);
  }
  if (admin_note !== undefined) {
    const trimmed = (admin_note || '').trim();
    if (trimmed.length > ADMIN_NOTE_MAX) {
      return NextResponse.json(
        { error: `Note must be ${ADMIN_NOTE_MAX} characters or fewer.` },
        { status: 400 }
      );
    }
    fields.push(`admin_note = $${i++}`);
    values.push(trimmed || null);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }
  fields.push(`updated_at = now()`);

  try {
    values.push(params.id);
    const result = await query(
      `UPDATE reports SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, reason, details, status, admin_note, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }
    return NextResponse.json({ report: result.rows[0] });
  } catch (err) {
    console.error('admin/reports PATCH failed:', err);
    return NextResponse.json({ error: 'Could not save this update.' }, { status: 500 });
  }
}
