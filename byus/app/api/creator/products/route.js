export const dynamic = 'force-dynamic';

// GET  /api/creator/products -> a creator's own products, each with its file bundle
// POST /api/creator/products -> create a product from files already uploaded to Blob
//
// Files no longer travel through this route's request body (see
// app/api/creator/products/upload-token/route.js for why -- the short version is
// Vercel's 4.5MB function body limit). The browser uploads each file to Vercel Blob
// directly first, then calls this route with the resulting URLs/metadata to create
// the product and its digital_product_files rows in one transaction. Every field the
// client claims about a file (content type, size) is re-validated here against the
// same allow-list the upload-token route enforced -- never trust the client twice
// removed from where the bytes actually landed.

import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { containsBlockedContent } from '@/lib/content-policy';
import { MIN_DIGITAL_PRODUCT_PRICE_CENTS } from '@/lib/pricing';
import { classifyFile, MAX_FILES_PER_PRODUCT } from '@/lib/product-files';

const TITLE_MAX = 160;
const DESCRIPTION_MAX = 3000;
const MAX_PRICE_CENTS = 500000;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view products.' }, { status: 403 });
  }

  const result = await query(
    `SELECT p.id, p.title, p.description, p.price_cents, p.access_type, p.active, p.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', f.id, 'file_name', f.file_name, 'file_size_bytes', f.file_size_bytes,
                  'kind', f.kind
                ) ORDER BY f.position, f.created_at
              ) FILTER (WHERE f.id IS NOT NULL), '[]'
            ) AS files
     FROM digital_products p
     LEFT JOIN digital_product_files f ON f.product_id = p.id
     WHERE p.creator_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
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
    const body = await request.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const accessType = body.accessType === 'subscribers_only' ? 'subscribers_only' : 'purchase';
    const priceCents = accessType === 'purchase' ? Math.round(Number(body.price) * 100) : null;
    const files = Array.isArray(body.files) ? body.files : [];

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
        (!Number.isInteger(priceCents) || priceCents < MIN_DIGITAL_PRODUCT_PRICE_CENTS || priceCents > MAX_PRICE_CENTS)) {
      return NextResponse.json({ error: 'Price must be between $5.00 and $5,000.00.' }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: 'Add at least one file.' }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_PRODUCT) {
      return NextResponse.json({ error: `A product can include at most ${MAX_FILES_PER_PRODUCT} files.` }, { status: 400 });
    }

    const validatedFiles = [];
    for (const f of files) {
      const url = String(f?.url || '');
      const name = String(f?.name || '').trim().slice(0, 200);
      const size = Number(f?.size);
      const contentType = String(f?.contentType || '');
      if (!url || !url.startsWith('https://') || !name) {
        return NextResponse.json({ error: 'One of the uploaded files is missing required information.' }, { status: 400 });
      }
      const check = classifyFile(contentType, size);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      validatedFiles.push({ url, name, size, contentType, kind: check.kind });
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

    const product = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO digital_products (creator_id, title, description, price_cents, access_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, price_cents, access_type, active, created_at`,
        [session.userId, title, description || null, priceCents, accessType]
      );
      const newProduct = inserted.rows[0];

      const insertedFiles = [];
      for (let i = 0; i < validatedFiles.length; i++) {
        const f = validatedFiles[i];
        const fileRow = await client.query(
          `INSERT INTO digital_product_files
             (product_id, file_url, file_name, file_size_bytes, content_type, kind, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, file_name, file_size_bytes, kind`,
          [newProduct.id, f.url, f.name, f.size, f.contentType, f.kind, i]
        );
        insertedFiles.push(fileRow.rows[0]);
      }

      return { ...newProduct, files: insertedFiles };
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('creator/products POST failed:', err);
    return NextResponse.json({ error: 'Could not create this product. Try again.' }, { status: 500 });
  }
}
