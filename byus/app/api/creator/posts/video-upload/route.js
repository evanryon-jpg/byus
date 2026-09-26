export const dynamic = 'force-dynamic';

// POST /api/creator/posts/video-upload
//
// Mints a short-lived Mux "direct upload" URL so the creator's browser can PUT a
// video file straight to Mux, never through this Next.js route -- same reasoning as
// /api/creator/products/upload-token and /api/creator/upload: a Vercel Function caps
// request bodies and run time, and a real video routinely blows past both.
//
// This only ever returns a signed upload URL + its id. The upload_id gets recorded
// against this creator in `video_uploads` so that later, when the post is actually
// created, the server can verify the resulting Mux asset really was this creator's
// own upload rather than trusting an assetId/playbackId the client could otherwise
// just make up (see the POST handler in ../route.js).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { createDirectUpload } from '@/lib/mux';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getVideoStorage } from '@/lib/video-storage';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can upload video.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('video-upload', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    // Video storage allowance (lib/video-limits.js): 10 hours plus 1 per paying member.
    const storage = await getVideoStorage(session.userId);
    if (storage.full) {
      const hrs = (s) => Math.round((s / 3600) * 10) / 10;
      return NextResponse.json(
        {
          error: `You're using ${hrs(storage.usedSeconds)} of your ${hrs(storage.limitSeconds)} hours of video storage. Each paying member adds another hour, or delete an older video to make room.`,
          storage,
        },
        { status: 403 }
      );
    }

    const origin = request.headers.get('origin') || process.env.APP_URL;
    const upload = await createDirectUpload(origin);

    await query(
      `INSERT INTO video_uploads (upload_id, creator_id) VALUES ($1, $2)`,
      [upload.id, session.userId]
    );

    return NextResponse.json({ uploadUrl: upload.url, uploadId: upload.id });
  } catch (err) {
    console.error('video-upload POST failed:', err);
    return NextResponse.json(
      { error: 'Could not start this video upload. Try again.' },
      { status: 500 }
    );
  }
}
