export const dynamic = 'force-dynamic';

// GET /api/creators
// Public list of all creators, for the "Browse creators" page.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT id, display_name, bio, profile_image_url
       FROM users WHERE role = 'creator' ORDER BY created_at DESC`
    );
    // profile_image_url in the DB is a private Blob pathname — point the
    // client at our own public proxy route instead of exposing it directly.
    const creators = result.rows.map((c) => ({
      ...c,
      profile_image_url: c.profile_image_url ? `/api/avatar/${c.id}` : null,
    }));
    return NextResponse.json({ creators });
  } catch (err) {
    console.error('creators GET failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not load creators. Try again.' },
      { status: 500 }
    );
  }
}
