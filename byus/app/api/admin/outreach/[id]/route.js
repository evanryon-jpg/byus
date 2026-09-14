export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { loadOutreachContacts } from '@/lib/admin-data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['planned', 'messaged', 'replied', 'interested', 'not_interested']);

// Same normalization as the create endpoint (app/api/admin/outreach/route.js) — kept in
// sync by hand since there's no shared module yet; if that ever drifts, editing a handle
// here could start accepting values POST would reject.
function normalizeHandle(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];
}

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid outreach contact.' }, { status: 400 });
  }

  const limit = await checkRateLimit('outreach', `user:${session.userId}`);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many changes. Wait a moment and try again.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    let result;
    if (body.action === 'mark_messaged') {
      // Guards against an accidental double-send being recorded twice: once a contact is
      // already past 'planned', a second mark_messaged (e.g. a stray double-click before
      // the button re-renders) is a no-op instead of silently resetting the 7-day
      // follow-up clock and wiping out a follow-up that was already logged.
      result = await query(
        `UPDATE outreach_contacts
         SET status = 'messaged',
             messaged_at = now(),
             follow_up_due_at = now() + interval '7 days',
             followed_up_at = NULL,
             updated_at = now()
         WHERE id = $1 AND status = 'planned'
         RETURNING id`,
        [params.id]
      );
      if (result.rows.length === 0) {
        const contacts = await loadOutreachContacts();
        const existing = contacts.find((item) => item.id === params.id);
        if (existing) return NextResponse.json({ contact: existing });
        return NextResponse.json({ error: 'Outreach contact not found.' }, { status: 404 });
      }
    } else if (body.action === 'mark_followed_up') {
      // Same guard: only fires from the one state it's meant to fire from.
      result = await query(
        `UPDATE outreach_contacts
         SET followed_up_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'messaged' AND followed_up_at IS NULL
         RETURNING id`,
        [params.id]
      );
      if (result.rows.length === 0) {
        const contacts = await loadOutreachContacts();
        const existing = contacts.find((item) => item.id === params.id);
        if (existing) return NextResponse.json({ contact: existing });
        return NextResponse.json({ error: 'Outreach contact not found.' }, { status: 404 });
      }
    } else if (STATUSES.has(body.status)) {
      result = await query(
        `UPDATE outreach_contacts SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
        [body.status, params.id]
      );
    } else if (body.action === 'edit_details') {
      const instagramHandle = normalizeHandle(body.instagramHandle);
      const followerCount =
        body.followerCount === '' || body.followerCount === null || body.followerCount === undefined
          ? null
          : Number(body.followerCount);
      const latestContentNote = typeof body.latestContentNote === 'string' ? body.latestContentNote.trim() : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

      if (!/^[A-Za-z0-9._]{1,30}$/.test(instagramHandle)) {
        return NextResponse.json({ error: 'Enter a valid Instagram handle.' }, { status: 400 });
      }
      if (followerCount !== null && (!Number.isInteger(followerCount) || followerCount < 0 || followerCount > 2000000000)) {
        return NextResponse.json({ error: 'Enter a valid follower count.' }, { status: 400 });
      }
      if (latestContentNote.length > 1000 || notes.length > 2000) {
        return NextResponse.json({ error: 'One of the notes is too long.' }, { status: 400 });
      }

      result = await query(
        `UPDATE outreach_contacts
         SET instagram_handle = $1, follower_count = $2, latest_content_note = $3, notes = $4, updated_at = now()
         WHERE id = $5
         RETURNING id`,
        [instagramHandle, followerCount, latestContentNote || null, notes || null, params.id]
      );
    } else {
      return NextResponse.json({ error: 'Choose a valid tracker action.' }, { status: 400 });
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Outreach contact not found.' }, { status: 404 });
    }

    const contacts = await loadOutreachContacts();
    return NextResponse.json({ contact: contacts.find((item) => item.id === params.id) });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Another creator in your tracker already has that handle.' }, { status: 409 });
    }
    console.error('admin/outreach PATCH failed:', err);
    return NextResponse.json({ error: 'Could not update that creator.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid outreach contact.' }, { status: 400 });
  }

  const limit = await checkRateLimit('outreach', `user:${session.userId}`);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many changes. Wait a moment and try again.' }, { status: 429 });
  }

  try {
    const result = await query(`DELETE FROM outreach_contacts WHERE id = $1 RETURNING id`, [params.id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Outreach contact not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: params.id });
  } catch (err) {
    console.error('admin/outreach DELETE failed:', err);
    return NextResponse.json({ error: 'Could not remove that creator.' }, { status: 500 });
  }
}
