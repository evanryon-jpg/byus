export const dynamic = 'force-dynamic';

// POST /api/creator/products/upload-token
//
// Issues a short-lived Vercel Blob client-upload token so the browser can send a
// product file straight to Blob storage, never through this Next.js route. That's
// not an optimization -- it's required: Vercel Functions cap request bodies at
// 4.5MB (https://vercel.com/docs/functions/limitations#request-body-size), and
// digital products now include audio/video files that routinely exceed that. The
// old route read `request.formData()` directly, which silently capped every "up to
// 25MB" PDF at 4.5MB in practice and would have made audio/video uploads DOA.
//
// This route never writes to the database -- it only decides whether a token should
// be issued at all (auth + allow-list) and records nothing until the creator submits
// the finished product in POST /api/creator/products with the URLs Blob handed back.
import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { getCurrentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { ALLOWED_CONTENT_TYPES, classifyFile } from '@/lib/product-files';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request) {
  // Checked up front, before handing off to handleUpload's own callback -- this route's
  // whole job is deciding whether to issue a token at all (see the file header comment),
  // and issuing one is the same real cost (a Blob storage grant) as the `upload` and
  // `product-upload` limiters already guard elsewhere. This had no limit at all before
  // Sep 18, 2026's infra hardening pass, unlike every sibling upload route.
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can upload product files.' }, { status: 403 });
  }
  const rateCheck = await checkRateLimit('product-upload', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const creatorResult = await query(
          'SELECT review_cleared_at FROM users WHERE id = $1',
          [session.userId]
        );
        if (!creatorResult.rows[0]?.review_cleared_at) {
          throw new Error('Your creator review must be completed before uploading product files.');
        }

        // Keep every creator's files namespaced under their own id in the bucket.
        // `addRandomSuffix: true` below is the actual anti-collision/anti-overwrite
        // guarantee (and `allowOverwrite` is left at its default `false`) -- this is
        // just tidy storage layout, not the security boundary.
        if (!pathname.startsWith(`products/${session.userId}/`)) {
          throw new Error('Invalid upload path.');
        }

        let requestedType = null;
        try {
          requestedType = clientPayload ? JSON.parse(clientPayload).contentType : null;
        } catch {
          // fall through to the generic allow-list below
        }
        if (requestedType) {
          const check = classifyFile(requestedType, 1); // size isn't known yet; checked again below via maximumSizeInBytes
          if (!check.ok && !check.error.startsWith('File is empty')) {
            throw new Error(check.error);
          }
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: 1024 * 1024 * 1024, // hard ceiling; per-type caps are re-checked in POST /api/creator/products
          tokenPayload: JSON.stringify({ userId: session.userId }),
        };
      },
      onUploadCompleted: async () => {
        // No DB write here on purpose -- the browser already has the resolved blob
        // URL from the `upload()` call and includes it in the product-creation POST.
        // This callback is Blob's own completion signal, kept as a no-op safety net
        // rather than a second source of truth.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not authorize this upload.' }, { status: 400 });
  }
}
