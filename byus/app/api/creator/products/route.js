export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { containsBlockedContent } from '@/lib/content-policy';

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const TITLE_MAX = 160;
const DESCRIPTION_MAX = 3000;
const MIN_PRICE_CENTS = 500;
const MAX_PRICE_CENTS = 500000;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view products.' }, { status: 403 });
  }

  const result = await query(
    `SELECT id, title, description, price_cents, access_type, file_name,
            file_size_bytes, active, created_at
     FROM digital_products WHERE creator_id = $1 ORDER BY created_at DESC`,
    [session.userId]
  );
  return NextResponse.json({ products: result.rows });
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can sell files.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('product-upload', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();
    const accessType = form.get('accessType') === 'subscribers_only'
      ? 'subscribers_only'
      : 'purchase';
    const priceCents = accessType === 'purchase'
      ? Math.round(Number(form.get('price')) * 100)
      : null;

    if (!title || title.length > TITLE_MAX) {
      return NextResponse.json({ error: `Title is required and must be ${TITLE_MAX} characters or fewer.` }, { status: 400 });
    }
    if (description.length > DESCRIPTION_MAX) {
      return NextResponse.json({ error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` }, { status: 400 });
    }
    const policy = containsBlockedContent(title, description);
    if (policy.blocked) {
      return NextResponse.json({ error: `That product ${policy.message}.` }, { status: 400 });
    }
    if (accessType === 'purchase' &&
        (!Number.isInteger(priceCents) || priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS)) {
      return NextResponse.json({ error: 'Price must be between $5.00 and $5,000.00.' }, { status: 400 });
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Choose a PDF to upload.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' || file.size <= 0 || file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'Choose a valid PDF smaller than 25MB.' }, { status: 400 });
    }

    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!(header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 &&
          header[3] === 0x46 && header[4] === 0x2d)) {
      return NextResponse.json({ error: 'This file does not appear to be a valid PDF.' }, { status: 400 });
    }

    const creatorResult = await query(
      'SELECT review_cleared_at FROM users WHERE id = $1',
      [session.userId]
    );
    if (!creatorResult.rows[0]?.review_cleared_at) {
      return NextResponse.json(
        { error: 'Your creator review must be completed before publishing a downloadable product.' },
        { status: 403 }
      );
    }

    const pathname = `products/${session.userId}/${crypto.randomUUID()}.pdf`;
    const blob = await put(pathname, file, { access: 'private', contentType: 'application/pdf' });
    const safeName = file.name.toLowerCase().endsWith('.pdf') ? file.name.slice(0, 180) : `${file.name.slice(0, 176)}.pdf`;

    const inserted = await query(
      `INSERT INTO digital_products
         (creator_id, title, description, price_cents, access_type, file_url, file_name, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, price_cents, access_type, file_name,
                 file_size_bytes, active, created_at`,
      [session.userId, title, description || null, priceCents, accessType, blob.pathname, safeName, file.size]
    );

    return NextResponse.json({ product: inserted.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('creator/products POST failed:', err);
    return NextResponse.json({ error: 'Could not create this product. Try again.' }, { status: 500 });
  }
}
