export const dynamic = 'force-dynamic';

// GET /api/creator/live — the signed-in creator's live-streaming setup (RTMP URL +
// stream key to paste into OBS/streaming software, plus current live/offline status).
// POST /api/creator/live — sets it up the first time. A creator has exactly one live
// stream, reused for every session, so calling this again just hands back what's
// already there instead of creating a second one.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { createLiveStream, MUX_RTMP_URL } from '@/lib/mux';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  if (session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can go live.' }, { status: 403 });
  }

  const result = await query(
    'SELECT mux_live_stream_id, mux_stream_key, mux_playback_id, is_live FROM users WHERE id = $1',
    [session.userId]
  );
  const row = result.rows[0];
  const configured = Boolean(row?.mux_live_stream_id);

  return NextResponse.json({
    configured,
    isLive: Boolean(row?.is_live),
    rtmpUrl: configured ? MUX_RTMP_URL : null,
    streamKey: configured ? row.mux_stream_key : null,
  });
}

export async function POST() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  if (session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can go live.' }, { status: 403 });
  }

  const existing = await query(
    'SELECT mux_live_stream_id, mux_stream_key FROM users WHERE id = $1',
    [session.userId]
  );
  if (existing.rows[0]?.mux_live_stream_id) {
    return NextResponse.json({
      configured: true,
      rtmpUrl: MUX_RTMP_URL,
      streamKey: existing.rows[0].mux_stream_key,
    });
  }

  try {
    const stream = await createLiveStream();
    await query(
      'UPDATE users SET mux_live_stream_id = $1, mux_playback_id = $2, mux_stream_key = $3 WHERE id = $4',
      [stream.id, stream.playback_ids?.[0]?.id || null, stream.stream_key, session.userId]
    );
    return NextResponse.json({
      configured: true,
      rtmpUrl: MUX_RTMP_URL,
      streamKey: stream.stream_key,
    });
  } catch (err) {
    console.error('live stream setup failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not set up live streaming. Try again.' },
      { status: 500 }
    );
  }
}
