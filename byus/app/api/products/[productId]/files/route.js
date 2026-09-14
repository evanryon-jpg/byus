export const dynamic = 'force-dynamic';

// GET /api/products/:productId/files
//
// Lists the files in a product's bundle for someone who's authorized to have them --
// owner previewing their own listing, a fan who purchased it, or a subscriber whose
// membership includes it. Replaces the old single-file
// /api/products/:productId/download route now that a product can bundle several
// files: this endpoint returns metadata only (no blob URLs), and each file is
// streamed individually via /api/products/:productId/files/:fileId, which re-checks
// the same authorization independently rather than trusting this list.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });

  try {
    const result = await query(
      `SELECT id, creator_id, access_type, active FROM digital_products WHERE id = $1`,
      [params.productId]
    );
    const product = result.rows[0];
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const isOwner = session.userId === product.creator_id;
    let authorized = isOwner;
    if (!authorized && session.role === 'fan') {
      if (product.access_type === 'purchase') {
        const purchase = await query(
          `SELECT 1 FROM digital_purchases WHERE product_id = $1 AND fan_id = $2 AND status = 'succeeded'`,
          [product.id, session.userId]
        );
        authorized = purchase.rows.length > 0;
      } else {
        const subscription = await query(
          `SELECT 1 FROM subscriptions
           WHERE creator_id = $1 AND fan_id = $2 AND status = 'active'
             AND (current_period_end IS NULL OR current_period_end > now())
           LIMIT 1`,
          [product.creator_id, session.userId]
        );
        authorized = subscription.rows.length > 0;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Purchase or an active membership is required.' }, { status: 403 });
    }

    const files = await query(
      `SELECT id, file_name, file_size_bytes, kind
       FROM digital_product_files WHERE product_id = $1 ORDER BY position, created_at`,
      [product.id]
    );

    return NextResponse.json({ files: files.rows });
  } catch (err) {
    console.error('product files list failed:', err);
    return NextResponse.json({ error: 'Could not load these files. Try again.' }, { status: 500 });
  }
}
