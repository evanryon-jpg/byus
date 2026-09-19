export const dynamic = 'force-dynamic';

// GET /api/admin/tasks, POST /api/admin/tasks
// The team's own internal punch-list (see database/migrations/20260919_admin_tasks.sql)
// -- a minimal replacement for tracking work by hand across chat/notes. Gated by the
// same lib/admin.js email allowlist as the rest of /api/admin. The initial list for
// /admin itself is server-rendered (see lib/admin-data.js's loadAdminTasks, called from
// app/admin/page.js); GET here only backs client-side refreshes after a mutation.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { loadAdminTasks } from '@/lib/admin-data';

const TITLE_MAX = 200;
const CATEGORY_MAX = 60;
const NOTES_MAX = 4000;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    return NextResponse.json({ tasks: await loadAdminTasks() });
  } catch (err) {
    console.error('admin/tasks GET failed:', err);
    return NextResponse.json({ error: 'Could not load the task list.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!title) {
    return NextResponse.json({ error: 'Give the task a title.' }, { status: 400 });
  }
  if (title.length > TITLE_MAX) {
    return NextResponse.json({ error: `Title must be ${TITLE_MAX} characters or fewer.` }, { status: 400 });
  }
  if (category.length > CATEGORY_MAX) {
    return NextResponse.json({ error: `Category must be ${CATEGORY_MAX} characters or fewer.` }, { status: 400 });
  }
  if (notes.length > NOTES_MAX) {
    return NextResponse.json({ error: `Notes must be ${NOTES_MAX} characters or fewer.` }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO admin_tasks (title, category, notes)
       VALUES ($1, $2, $3)
       RETURNING id, title, status, category, notes, created_at, updated_at`,
      [title, category || null, notes || null]
    );
    const row = result.rows[0];
    return NextResponse.json(
      {
        task: {
          id: row.id,
          title: row.title,
          status: row.status,
          category: row.category || '',
          notes: row.notes || '',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('admin/tasks POST failed:', err);
    return NextResponse.json({ error: 'Could not save that task.' }, { status: 500 });
  }
}
