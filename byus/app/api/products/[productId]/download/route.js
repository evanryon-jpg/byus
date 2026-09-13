export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

function safeDownloadName(name) {
  const cleaned = String(name || 'download.pdf').replace(/[\r\n"]/g, '').slice(0, 180);
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Please log in to download.' }, { status: 401 });

  try {
    const result = await query(
      `SELECT id, creator_id, access_type, file_url, file_name, active
       FROM digital_products WHERE id = $1`,
      [params.productId]
    );
    const product = result.rows[0];
    if (!product) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const isOwner = session.userId === product.creator_id;
    let authorized = isOwner;
    if (!authorized && session.role === 'fan') {
      if (product.access_type === 'purchase') {
        const purchase = await query(
          `SELECT 1 FROM digital_purchases
           WHERE product_id = $1 AND fan_id = $2 AND status = 'succeeded'`,
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

    const blob = await get(product.file_url, { access: 'private' });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeDownloadName(product.file_name)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('product download failed:', err);
    return NextResponse.json({ error: 'Could not download this file. Try again.' }, { status: 500 });
  }
}
