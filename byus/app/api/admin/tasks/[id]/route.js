export const dynamic = 'force-dynamic';

// PATCH /api/admin/tasks/[id] -> { title?, status?, category?, notes? }
// DELETE /api/admin/tasks/[id]
// Same shape as app/api/admin/outreach/[id]/route.js: partial-update PATCH plus a
// straight DELETE, both gated by lib/admin.js's isAdmin() check.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['todo', 'doing', 'done']);
const TITLE_MAX = 200;
const CATEGORY_MAX = 60;
const NOTES_MAX = 4000;

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid task.' }, { status: 400 });
  }

  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const body = await request.json().catch(() => ({}));
  const fields = [];
  const values = [];
  let i = 1;

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Give the task a title.' }, { status: 400 });
    }
    if (title.length > TITLE_MAX) {
      return NextResponse.json({ error: `Title must be ${TITLE_MAX} characters or fewer.` }, { status: 400 });
    }
    fields.push(`title = $${i++}`);
    values.push(title);
  }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }
    fields.push(`status = $${i++}`);
    values.push(body.status);
  }
  if (body.category !== undefined) {
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (category.length > CATEGORY_MAX) {
      return NextResponse.json({ error: `Category must be ${CATEGORY_MAX} characters or fewer.` }, { status: 400 });
    }
    fields.push(`category = $${i++}`);
    values.push(category || null);
  }
  if (body.notes !== undefined) {
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (notes.length > NOTES_MAX) {
      return NextResponse.json({ error: `Notes must be ${NOTES_MAX} characters or fewer.` }, { status: 400 });
    }
    fields.push(`notes = $${i++}`);
    values.push(notes || null);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }
  fields.push(`updated_at = now()`);

  try {
    values.push(params.id);
    const result = await query(
      `UPDATE admin_tasks SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, title, status, category, notes, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    const row = result.rows[0];
    return NextResponse.json({
      task: {
        id: row.id,
        title: row.title,
        status: row.status,
        category: row.category || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('admin/tasks PATCH failed:', err);
    return NextResponse.json({ error: 'Could not save this update.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid task.' }, { status: 400 });
  }

  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const result = await query(`DELETE FROM admin_tasks WHERE id = $1 RETURNING id`, [params.id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: params.id });
  } catch (err) {
    console.error('admin/tasks DELETE failed:', err);
    return NextResponse.json({ error: 'Could not remove that task.' }, { status: 500 });
  }
}
