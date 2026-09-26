export const dynamic = 'force-dynamic';

// DELETE /api/creator/switch-links/:id -> turns a switching link off. Fans who already
// joined through it keep their delayed first charge; nobody new can use it.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function DELETE(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  try {
    const result = await query(
      `UPDATE switch_links SET active = false WHERE id = $1 AND creator_id = $2 RETURNING id`,
      [params.id, session.userId]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('creator/switch-links DELETE failed:', err);
    return NextResponse.json({ error: 'Could not turn this link off.' }, { status: 500 });
  }
}
