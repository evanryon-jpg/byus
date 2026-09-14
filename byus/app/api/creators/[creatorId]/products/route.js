export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  const key = params.creatorId;

  const creatorResult = await query(
    UUID_RE.test(key)
      ? `SELECT id FROM users WHERE id = $1 AND role = 'creator'
           AND is_suspended = false AND review_cleared_at IS NOT NULL`
      : `SELECT id FROM users WHERE slug = $1 AND role = 'creator'
           AND is_suspended = false AND review_cleared_at IS NOT NULL`,
    [key]
  );
  const creator = creatorResult.rows[0];
  if (!creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

  let hasSubscription = false;
  const owned = new Set();
  if (session?.role === 'fan') {
    const [subResult, purchaseResult] = await Promise.all([
      query(
        `SELECT 1 FROM subscriptions
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
           AND (current_period_end IS NULL OR current_period_end > now())
         LIMIT 1`,
        [session.userId, creator.id]
      ),
      query(
        `SELECT product_id FROM digital_purchases
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'succeeded'`,
        [session.userId, creator.id]
      ),
    ]);
    hasSubscription = subResult.rows.length > 0;
    purchaseResult.rows.forEach((row) => owned.add(row.product_id));
  }

  const result = await query(
    `SELECT p.id, p.title, p.description, p.price_cents, p.access_type,
            COALESCE(
              json_agg(
                json_build_object('id', f.id, 'file_name', f.file_name, 'file_size_bytes', f.file_size_bytes, 'kind', f.kind)
                ORDER BY f.position, f.created_at
              ) FILTER (WHERE f.id IS NOT NULL), '[]'
            ) AS files
     FROM digital_products p
     LEFT JOIN digital_product_files f ON f.product_id = p.id
     WHERE p.creator_id = $1 AND p.active = true
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [creator.id]
  );

  // File metadata (name/size/kind) is harmless to show pre-purchase -- it's the blob
  // URLs (never selected here) that stay gated behind /api/products/:id/files/:fileId's
  // own ownership/purchase/subscription check, so there's no need to strip the list
  // down to just a count for products someone hasn't unlocked yet.
  const products = result.rows.map((product) => ({
    ...product,
    owned: owned.has(product.id),
    downloadable: owned.has(product.id) ||
      (product.access_type === 'subscribers_only' && hasSubscription),
  }));
  return NextResponse.json({ products });
}
