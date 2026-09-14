export const dynamic = 'force-dynamic';

// GET /api/products/:productId/files/:fileId -- streams one specific file from a
// product's bundle. Authorization is re-checked here independently of the list
// endpoint (same ownership/purchase/subscription rule used throughout the app) so
// this route is safe to hit directly, not just via the file list. Content-Type and
// the download filename now come from the actual uploaded file instead of being
// hardcoded to application/pdf -- the old single-file route always served
// `application/pdf` regardless of what was actually stored.
import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

function safeDownloadName(name, fallbackExt) {
  const cleaned = String(name || `download.${fallbackExt}`).replace(/[\r\n"]/g, '').slice(0, 200);
  return cleaned || `download.${fallbackExt}`;
}

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Please log in to download.' }, { status: 401 });

  try {
    const result = await query(
      `SELECT f.id, f.file_url, f.file_name, f.content_type,
              p.id AS product_id, p.creator_id, p.access_type, p.active
       FROM digital_product_files f
       JOIN digital_products p ON p.id = f.product_id
       WHERE f.id = $1 AND f.product_id = $2`,
      [params.fileId, params.productId]
    );
    const file = result.rows[0];
    if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const isOwner = session.userId === file.creator_id;
    let authorized = isOwner;
    if (!authorized && session.role === 'fan') {
      if (file.access_type === 'purchase') {
        const purchase = await query(
          `SELECT 1 FROM digital_purchases WHERE product_id = $1 AND fan_id = $2 AND status = 'succeeded'`,
          [file.product_id, session.userId]
        );
        authorized = purchase.rows.length > 0;
      } else {
        const subscription = await query(
          `SELECT 1 FROM subscriptions
           WHERE creator_id = $1 AND fan_id = $2 AND status = 'active'
             AND (current_period_end IS NULL OR current_period_end > now())
           LIMIT 1`,
          [file.creator_id, session.userId]
        );
        authorized = subscription.rows.length > 0;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Purchase or an active membership is required.' }, { status: 403 });
    }

    const blob = await get(file.file_url, { access: 'private' });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': file.content_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeDownloadName(file.file_name, 'bin')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('product file download failed:', err);
    return NextResponse.json({ error: 'Could not download this file. Try again.' }, { status: 500 });
  }
}
