export const dynamic = 'force-dynamic';
// A Mux asset lookup per video, fanned out concurrently -- fine for a normal
// catalog, but a creator with a very large number of videos could push this past
// the default 10s. No DB-side status cache is kept on purpose: Mux is the only
// source of truth for rendition progress, so every load reflects real encoding
// state instead of something that could drift out of sync.
export const maxDuration = 30;

// GET  /api/creator/video-export -> status of every video in the creator's own
//                                    catalog: ready (with a signed download link),
//                                    still preparing, errored, or not yet
//                                    requested. Read-only, so it isn't rate-limited
//                                    -- a creator should be able to refresh this as
//                                    often as they want while Mux finishes encoding.
// POST /api/creator/video-export -> kicks off a downloadable MP4 (a Mux "static
//                                    rendition") for every video that doesn't
//                                    already have one ready or in progress. See
//                                    lib/rate-limit.js's video-export limiter for
//                                    why this is capped at once per day.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getAsset, requestStaticRendition } from '@/lib/mux';
import { signDownloadToken } from '@/lib/mux-jwt';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

function safeFilename(title, fallback) {
  const base = (title || '').trim().slice(0, 80);
  const slug = base
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${slug || fallback}.mp4`;
}

async function loadCreatorVideoPosts(creatorId) {
  const { rows } = await query(
    `SELECT id, title, mux_asset_id, mux_playback_id, created_at
     FROM posts
     WHERE creator_id = $1 AND mux_asset_id IS NOT NULL AND mux_playback_id IS NOT NULL
     ORDER BY created_at DESC`,
    [creatorId]
  );
  return rows;
}

// Pulls the free "standard" rendition (if any) out of a Mux asset's
// static_renditions, whatever state it's currently in -- callers decide what to do
// with each status. This app only ever requests the standard tier (see
// requestStaticRendition in lib/mux.js), so there's no "advanced" case to handle.
function findStandardRendition(asset) {
  const files = asset?.static_renditions?.files || [];
  return files.find((f) => f.type === 'standard') || null;
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view this.' }, { status: 403 });
  }

  const posts = await loadCreatorVideoPosts(session.userId);

  const videos = await Promise.all(
    posts.map(async (post) => {
      const base = { postId: post.id, title: post.title || null, createdAt: post.created_at };
      let asset = null;
      try {
        asset = await getAsset(post.mux_asset_id);
      } catch (err) {
        console.error(`video-export: could not load Mux asset ${post.mux_asset_id}:`, err);
        return { ...base, status: 'errored', downloadUrl: null };
      }

      const rendition = findStandardRendition(asset);
      if (!rendition) {
        return { ...base, status: 'not_requested', downloadUrl: null };
      }
      if (rendition.status === 'ready') {
        const token = signDownloadToken(post.mux_playback_id);
        const filename = safeFilename(post.title, `byus-video-${post.id}`);
        const downloadUrl = `https://stream.mux.com/${post.mux_playback_id}/${rendition.name}?token=${token}&download=${encodeURIComponent(filename)}`;
        return { ...base, status: 'ready', downloadUrl };
      }
      if (rendition.status === 'errored' || rendition.status === 'skipped') {
        return { ...base, status: 'errored', downloadUrl: null };
      }
      return { ...base, status: 'preparing', downloadUrl: null };
    })
  );

  return NextResponse.json({ videos });
}

export async function POST() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can do this.' }, { status: 403 });
  }

  const rateLimitResult = await checkRateLimit('video-export', `user:${session.userId}`);
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  const posts = await loadCreatorVideoPosts(session.userId);
  if (posts.length === 0) {
    return NextResponse.json({ requested: 0, alreadyPending: 0, total: 0 });
  }

  let requested = 0;
  let alreadyPending = 0;

  // Best-effort per asset -- one video Mux can't currently process (still mid
  // upload processing, or a genuinely errored asset) shouldn't block requesting
  // renditions for the rest of a creator's catalog. Same reasoning as deleteAsset's
  // swallowed errors in lib/mux.js.
  await Promise.all(
    posts.map(async (post) => {
      try {
        const asset = await getAsset(post.mux_asset_id);
        if (findStandardRendition(asset)) {
          alreadyPending += 1;
          return;
        }
        await requestStaticRendition(post.mux_asset_id);
        requested += 1;
      } catch (err) {
        console.error(`video-export: could not request rendition for asset ${post.mux_asset_id}:`, err);
      }
    })
  );

  return NextResponse.json({ requested, alreadyPending, total: posts.length });
}
