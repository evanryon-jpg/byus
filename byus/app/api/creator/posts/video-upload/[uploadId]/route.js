export const dynamic = 'force-dynamic';

// GET /api/creator/posts/video-upload/:uploadId
//
// Polled by the dashboard composer after it finishes PUTting the file to Mux, purely
// to drive the "Processing video…" UI. This is a convenience read, not the security
// boundary -- the POST /api/creator/posts handler below re-resolves everything itself
// from the uploadId rather than trusting whatever this route last reported, so a stale
// or manipulated client-side read here can't get a bad asset attached to a post.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getUpload, getAsset } from '@/lib/mux';
import { MAX_VIDEO_DURATION_SECONDS } from '@/lib/video-limits';

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can check video uploads.' }, { status: 403 });
  }

  const { uploadId } = params;

  try {
    const owned = await query(
      `SELECT 1 FROM video_uploads WHERE upload_id = $1 AND creator_id = $2`,
      [uploadId, session.userId]
    );
    if (!owned.rows[0]) {
      return NextResponse.json({ error: 'Upload not found.' }, { status: 404 });
    }

    const upload = await getUpload(uploadId);
    if (upload.status === 'errored') {
      return NextResponse.json({ ready: false, errored: true });
    }
    if (!upload.asset_id) {
      return NextResponse.json({ ready: false }); // file hasn't finished arriving at Mux yet
    }

    const asset = await getAsset(upload.asset_id);
    if (asset.status === 'errored') {
      return NextResponse.json({ ready: false, errored: true });
    }
    if (asset.status !== 'ready') {
      return NextResponse.json({ ready: false }); // still transcoding
    }
    if (Number(asset.duration) > MAX_VIDEO_DURATION_SECONDS) {
      return NextResponse.json({
        ready: false,
        errored: true,
        error: 'Videos must be 30 minutes or shorter.',
      });
    }

    return NextResponse.json({ ready: true, playbackId: asset.playback_ids?.[0]?.id || null });
  } catch (err) {
    console.error('video-upload status GET failed:', err);
    return NextResponse.json({ error: 'Could not check this upload. Try again.' }, { status: 500 });
  }
}
