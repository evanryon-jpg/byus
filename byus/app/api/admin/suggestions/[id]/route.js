export const dynamic = 'force-dynamic';

// PATCH /api/admin/suggestions/[id] -> { status?, admin_note? }
// Lets the ByUs team triage a suggestion (move it through new -> reviewed -> planned ->
// shipped) and optionally leave a short reply that the submitter sees on their own
// Settings page — closing the loop on "help us help you" instead of the box being
// write-only. Gated the same way as the rest of /api/admin.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

const VALID_STATUSES = new Set(['new', 'reviewed', 'planned', 'shipped']);
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
        { error: `Reply must be ${ADMIN_NOTE_MAX} characters or fewer.` },
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
      `UPDATE suggestions SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, message, status, admin_note, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Suggestion not found.' }, { status: 404 });
    }
    return NextResponse.json({ suggestion: result.rows[0] });
  } catch (err) {
    console.error('admin/suggestions PATCH failed:', err);
    return NextResponse.json({ error: 'Could not save this update.' }, { status: 500 });
  }
}
