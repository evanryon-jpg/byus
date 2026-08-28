export const dynamic = 'force-dynamic';

// GET /api/me
// Returns the currently logged-in user's basic info, or 401 if not logged in.
// Used by the frontend to decide what to render (creator dashboard vs fan view, etc).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const session = getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, email, role, display_name, bio, profile_image_url,
              stripe_connect_onboarded
       FROM users WHERE id = $1`,
      [session.userId]
    );
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error('me GET failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not load your account. Try again.' },
      { status: 500 }
    );
  }
}
