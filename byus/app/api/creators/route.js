export const dynamic = 'force-dynamic';

// GET /api/creators
// Public list of all creators, for the "Browse creators" page.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const result = await query(
    `SELECT id, display_name, bio, profile_image_url
     FROM users WHERE role = 'creator' ORDER BY created_at DESC`
  );
  return NextResponse.json({ creators: result.rows });
}
