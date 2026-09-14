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
    `SELECT p.id, p.title, p.description,
            u.display_name AS creator_name, u.slug AS creator_slug,
            dp.created_at AS purchased_at,
            COALESCE(
              json_agg(
                json_build_object('id', f.id, 'file_name', f.file_name, 'file_size_bytes', f.file_size_bytes, 'kind', f.kind)
                ORDER BY f.position, f.created_at
              ) FILTER (WHERE f.id IS NOT NULL), '[]'
            ) AS files
     FROM digital_purchases dp
     JOIN digital_products p ON p.id = dp.product_id
     JOIN users u ON u.id = dp.creator_id
     LEFT JOIN digital_product_files f ON f.product_id = p.id
     WHERE dp.fan_id = $1 AND dp.status = 'succeeded'
     GROUP BY p.id, u.display_name, u.slug, dp.created_at
     ORDER BY dp.created_at DESC`,
    [session.userId]
  );

  return NextResponse.json({ downloads: result.rows });
}
