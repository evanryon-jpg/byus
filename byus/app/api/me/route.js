export const dynamic = 'force-dynamic';

// GET   /api/me  -> return the currently logged-in user's basic info, or 401 if not logged in.
// PATCH /api/me  -> update display_name / bio / tags / notify_new_posts / show_support_publicly
// for the currently logged-in user. show_support_publicly is fan-only in practice (a creator
// has no subscriptions of their own to show up in), off by default -- see
// app/api/creators/[creatorId]/route.js for where it's actually read back out.
// Used by the frontend to decide what to render (creator dashboard vs fan view, etc)
// and by the settings page to edit a profile. `tags` are the creator categories
// shown as filter chips on the public Browse page.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getPlatformMilestoneReductionPoints, applyPlatformMilestoneReduction } from '@/lib/fees';
import { isAdmin } from '@/lib/admin';
import { publicAvatarUrl } from '@/lib/avatar-url';

// Matches the cap used at signup — keep both in sync since they constrain the same column.
const DISPLAY_NAME_MAX = 100;
// Generous but bounded — bio is rendered on the public profile page, so an unbounded
// value is both a layout hazard and a free place to dump arbitrary amounts of text.
const BIO_MAX = 1000;

// profile_image_url in the DB is a private Blob pathname (or a `preset:<id>`
// marker), never exposed directly — point the client at our own public proxy
// route instead, versioned so switching photos actually changes the URL
// (see lib/avatar-url.js).
function withAvatarUrl(user) {
  return { ...user, profile_image_url: publicAvatarUrl(user.id, user.profile_image_url) };
}

// Adds the fee this user is actually being charged right now: their personal tier minus
// whatever platform-wide milestone bonus is currently in effect (see lib/fees.js) — the
// dashboard shows this, not the raw platform_fee_percent column, so a creator's "you keep
// X%" preview always matches what Stripe is really billing.
async function withEffectiveFee(user) {
  const reductionPoints = await getPlatformMilestoneReductionPoints(query);
  return {
    ...user,
    effective_fee_percent: applyPlatformMilestoneReduction(user.platform_fee_percent, reductionPoints),
  };
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
              stripe_connect_onboarded, tags, email_verified, platform_fee_percent, notify_new_posts,
              show_support_publicly, support_goal_cents
       FROM users WHERE id = $1`,
      [session.userId]
    );
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const enriched = await withEffectiveFee(withAvatarUrl(user));
    return NextResponse.json({ user: { ...enriched, is_admin: isAdmin(session) } });
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

  const { display_name, bio, tags, notify_new_posts, show_support_publicly, support_goal_cents } =
    await request.json();

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
  if (notify_new_posts !== undefined) {
    fields.push(`notify_new_posts = $${i++}`);
    values.push(Boolean(notify_new_posts));
  }
  if (show_support_publicly !== undefined) {
    fields.push(`show_support_publicly = $${i++}`);
    values.push(Boolean(show_support_publicly));
  }
  // A creator's monthly support goal, shown as a progress bar on their public page (see
  // app/api/creators/[creatorId]/route.js) — null clears it and hides the bar entirely,
  // which is also how a creator removes it once set.
  if (support_goal_cents !== undefined) {
    if (support_goal_cents !== null && (!Number.isInteger(support_goal_cents) || support_goal_cents < 100)) {
      return NextResponse.json(
        { error: 'Support goal must be at least $1.00, or left blank to remove it.' },
        { status: 400 }
      );
    }
    fields.push(`support_goal_cents = $${i++}`);
    values.push(support_goal_cents);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    values.push(session.userId);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, email, role, display_name, bio, profile_image_url, stripe_connect_onboarded, tags, email_verified, platform_fee_percent, notify_new_posts, show_support_publicly, support_goal_cents`,
      values
    );

    const enriched = await withEffectiveFee(withAvatarUrl(result.rows[0]));
    return NextResponse.json({ user: { ...enriched, is_admin: isAdmin(session) } });
  } catch (err) {
    console.error('me PATCH failed:', err);
    return NextResponse.json(
      { error: 'Could not save your changes. Try again.' },
      { status: 500 }
    );
  }
}
