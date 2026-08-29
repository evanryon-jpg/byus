export const dynamic = 'force-dynamic';

// GET   /api/me  -> return the currently logged-in user's basic info, or 401 if not logged in.
// PATCH /api/me  -> update display_name / bio / tags for the currently logged-in user.
// Used by the frontend to decide what to render (creator dashboard vs fan view, etc)
// and by the settings page to edit a profile. `tags` are the creator categories
// shown as filter chips on the public Browse page.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

// Matches the cap used at signup — keep both in sync since they constrain the same column.
const DISPLAY_NAME_MAX = 100;
// Generous but bounded — bio is rendered on the public profile page, so an unbounded
// value is both a layout hazard and a free place to dump arbitrary amounts of text.
const BIO_MAX = 1000;

// profile_image_url in the DB is a private Blob pathname (or null) — never
// expose it directly, point the client at our own public proxy route instead.
function withAvatarUrl(user) {
  return { ...user, profile_image_url: user.profile_image_url ? `/api/avatar/${user.id}` : null };
}

// Validate + clean up a creator's category tags: trim, lowercase, dedupe,
// cap at 8 tags of up to 30 chars each, letters/numbers/spaces/hyphens only.
// Returns { tags } on success or { error } on the first invalid entry.
function normalizeTags(input) {
  if (!Array.isArray(input)) {
    return { error: 'Tags must be a list of strings.' };
  }
  const seen = new Set();
  const cleaned = [];
  for (const raw of input) {
    if (typeof raw !== 'string') {
      return { error: 'Each tag must be text.' };
    }
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > 30) {
      return { error: `"${tag}" is too long (max 30 characters).` };
    }
    if (!/^[a-z0-9][a-z0-9 -]*$/.test(tag)) {
      return { error: `"${tag}" can only contain letters, numbers, spaces, and hyphens.` };
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      cleaned.push(tag);
    }
  }
  if (cleaned.length > 8) {
    return { error: 'You can have at most 8 tags.' };
  }
  return { tags: cleaned };
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, email, role, display_name, bio, profile_image_url,
              stripe_connect_onboarded, tags
       FROM users WHERE id = $1`,
      [session.userId]
    );
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ user: withAvatarUrl(user) });
  } catch (err) {
    console.error('me GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load your account. Try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const { display_name, bio, tags } = await request.json();

  const fields = [];
  const values = [];
  let i = 1;

  if (display_name !== undefined) {
    const trimmed = (display_name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Display name cannot be empty.' }, { status: 400 });
    }
    if (trimmed.length > DISPLAY_NAME_MAX) {
      return NextResponse.json(
        { error: `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.` },
        { status: 400 }
      );
    }
    fields.push(`display_name = $${i++}`);
    values.push(trimmed);
  }
  if (bio !== undefined) {
    if (bio && bio.length > BIO_MAX) {
      return NextResponse.json(
        { error: `Bio must be ${BIO_MAX} characters or fewer.` },
        { status: 400 }
      );
    }
    fields.push(`bio = $${i++}`);
    values.push(bio || null);
  }
  if (tags !== undefined) {
    const normalized = normalizeTags(tags);
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    fields.push(`tags = $${i++}`);
    values.push(normalized.tags);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    values.push(session.userId);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, email, role, display_name, bio, profile_image_url, stripe_connect_onboarded, tags`,
      values
    );

    return NextResponse.json({ user: withAvatarUrl(result.rows[0]) });
  } catch (err) {
    console.error('me PATCH failed:', err);
    return NextResponse.json(
      { error: 'Could not save your changes. Try again.' },
      { status: 500 }
    );
  }
}
