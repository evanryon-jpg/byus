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
    `SELECT id, title, description, price_cents, access_type, file_name, file_size_bytes
     FROM digital_products
     WHERE creator_id = $1 AND active = true
     ORDER BY created_at DESC`,
    [creator.id]
  );

  const products = result.rows.map((product) => ({
    ...product,
    owned: owned.has(product.id),
    downloadable: owned.has(product.id) ||
      (product.access_type === 'subscribers_only' && hasSubscription),
  }));
  return NextResponse.json({ products });
}
