export const dynamic = 'force-dynamic';

// GET /api/creators
// Public list of creators, for the "Browse creators" page. Accepts optional
// `q` (matched against display_name/bio) and `tag` (a single category tag)
// query params to search and filter the list.
//
// Also returns `availableTags` — every tag currently in use across all
// creators, computed independently of the current q/tag filter — so the
// browse page's filter chips stay a stable, complete palette no matter what
// the visitor has already searched for or selected.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const tag = (searchParams.get('tag') || '').trim();

  try {
    const conditions = [`role = 'creator'`];
    const values = [];
    let i = 1;

    if (q) {
      conditions.push(`(display_name ILIKE $${i} OR bio ILIKE $${i})`);
      values.push(`%${q}%`);
      i++;
    }
    if (tag) {
      conditions.push(`$${i} = ANY(tags)`);
      values.push(tag);
      i++;
    }

    const [creatorsResult, tagsResult] = await Promise.all([
      query(
        `SELECT id, display_name, bio, profile_image_url, tags
         FROM users WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
        values
      ),
      query(
        `SELECT DISTINCT unnest(tags) AS tag FROM users
         WHERE role = 'creator' AND cardinality(tags) > 0 ORDER BY tag`
      ),
    ]);

    // profile_image_url in the DB is a private Blob pathname — point the
    // client at our own public proxy route instead of exposing it directly.
    const creators = creatorsResult.rows.map((c) => ({
      ...c,
      profile_image_url: c.profile_image_url ? `/api/avatar/${c.id}` : null,
    }));
    const availableTags = tagsResult.rows.map((r) => r.tag);

    return NextResponse.json({ creators, availableTags });
  } catch (err) {
    console.error('creators GET failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not load creators. Try again.' },
      { status: 500 }
    );
  }
}
