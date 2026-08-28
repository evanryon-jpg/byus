export const dynamic = 'force-dynamic';

// GET   /api/me  -> return the currently logged-in user's basic info, or 401 if not logged in.
// PATCH /api/me  -> update display_name / bio for the currently logged-in user.
// Used by the frontend to decide what to render (creator dashboard vs fan view, etc)
// and by the settings page to edit a profile.

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

export async function PATCH(request) {
  const session = getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const { display_name, bio } = await request.json();

  const fields = [];
  const values = [];
  let i = 1;

  if (display_name !== undefined) {
    const trimmed = (display_name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Display name cannot be empty.' }, { status: 400 });
    }
    fields.push(`display_name = $${i++}`);
    values.push(trimmed);
  }
  if (bio !== undefined) {
    fields.push(`bio = $${i++}`);
    values.push(bio || null);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    values.push(session.userId);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, email, role, display_name, bio, profile_image_url, stripe_connect_onboarded`,
      values
    );

    return NextResponse.json({ user: result.rows[0] });
  } catch (err) {
    console.error('me PATCH failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not save your changes. Try again.' },
      { status: 500 }
    );
  }
}
