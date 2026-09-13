export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can view downloads.' }, { status: 403 });
  }

  const result = await query(
    `SELECT p.id, p.title, p.description, p.file_name, p.file_size_bytes,
            u.display_name AS creator_name, u.slug AS creator_slug,
            dp.created_at AS purchased_at
     FROM digital_purchases dp
     JOIN digital_products p ON p.id = dp.product_id
     JOIN users u ON u.id = dp.creator_id
     WHERE dp.fan_id = $1 AND dp.status = 'succeeded'
     ORDER BY dp.created_at DESC`,
    [session.userId]
  );

  return NextResponse.json({
    downloads: result.rows.map((item) => ({
      ...item,
      download_url: `/api/products/${item.id}/download`,
    })),
  });
}
