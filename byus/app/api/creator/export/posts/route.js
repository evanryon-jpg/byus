export const dynamic = 'force-dynamic';

// GET /api/creator/export/posts
// Downloads every post the creator has written as a CSV: date, title, who could see
// it, the full text, poll options, whether it had an image or video, and views.
// Videos themselves come from the separate video download (video-export route);
// this file is the written side of "take your work with you."

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { csvDocument, csvResponse } from '@/lib/csv';

function pollText(options) {
  if (!options) return '';
  let list = options;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { return list; }
  }
  if (!Array.isArray(list)) return '';
  return list
    .map((opt) => (typeof opt === 'string' ? opt : opt?.label || opt?.text || ''))
    .filter(Boolean)
    .join(' | ');
}

function visibilityLabel(v) {
  if (v === 'public') return 'Everyone';
  if (v === 'subscribers_only') return 'Members only';
  return v || '';
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return new Response('Creators only.', { status: 403 });
  }

  try {
    const result = await query(
      `SELECT created_at, title, body, visibility, poll_options, media_url,
              mux_asset_id, view_count
       FROM posts
       WHERE creator_id = $1
       ORDER BY created_at ASC`,
      [session.userId]
    );

    const rows = result.rows.map((row) => [
      new Date(row.created_at).toISOString().slice(0, 10),
      row.title || '',
      visibilityLabel(row.visibility),
      row.body || '',
      pollText(row.poll_options),
      row.media_url ? 'Yes' : 'No',
      row.mux_asset_id ? 'Yes' : 'No',
      row.view_count ?? 0,
    ]);

    const csv = csvDocument(
      ['Date', 'Title', 'Who could see it', 'Text', 'Poll options', 'Had an image', 'Had a video', 'Views'],
      rows
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(csv, `byus-posts-${stamp}.csv`);
  } catch (err) {
    console.error('creator/export/posts GET failed:', err);
    return new Response('Could not build your posts file. Try again.', { status: 500 });
  }
}
