export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can manage products.' }, { status: 403 });
  }

  const { active } = await request.json();
  if (typeof active !== 'boolean') {
    return NextResponse.json({ error: 'active must be true or false.' }, { status: 400 });
  }

  const result = await query(
    `UPDATE digital_products SET active = $1, updated_at = now()
     WHERE id = $2 AND creator_id = $3
     RETURNING id, active`,
    [active, params.productId, session.userId]
  );
  if (!result.rows[0]) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }
  return NextResponse.json({ product: result.rows[0] });
}
