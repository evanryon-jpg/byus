export const dynamic = 'force-dynamic';

// GET /api/admin/suggestions
// Every suggestion ever submitted (creator or fan), newest-first within an open-first
// ordering — 'new' surfaces above everything else so the team sees unread ideas first,
// then 'reviewed'/'planned' before the fully closed-out 'shipped' ones. Gated by
// lib/admin.js's email allowlist, same as /api/admin/overview.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

const STATUS_ORDER = `CASE status
  WHEN 'new' THEN 0
  WHEN 'reviewed' THEN 1
  WHEN 'planned' THEN 2
  WHEN 'shipped' THEN 3
  ELSE 4 END`;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  try {
    const result = await query(
      `SELECT s.id, s.message, s.status, s.admin_note, s.created_at, s.updated_at,
              u.id AS user_id, u.display_name, u.email, u.role
       FROM suggestions s
       JOIN users u ON u.id = s.user_id
       ORDER BY ${STATUS_ORDER}, s.created_at DESC`
    );
    return NextResponse.json({ suggestions: result.rows });
  } catch (err) {
    console.error('admin/suggestions GET failed:', err);
    return NextResponse.json({ error: 'Could not load suggestions.' }, { status: 500 });
  }
}
