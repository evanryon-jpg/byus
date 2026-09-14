export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { loadOutreachContacts } from '@/lib/admin-data';

function normalizeHandle(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  try {
    return NextResponse.json({ contacts: await loadOutreachContacts() });
  } catch (err) {
    console.error('admin/outreach GET failed:', err);
    return NextResponse.json({ error: 'Could not load outreach contacts.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const limit = await checkRateLimit('outreach', `user:${session.userId}`);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many changes. Wait a moment and try again.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
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

  try {
    const result = await query(
      `INSERT INTO outreach_contacts
         (instagram_handle, follower_count, latest_content_note, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [instagramHandle, followerCount, latestContentNote || null, notes || null]
    );
    const contacts = await loadOutreachContacts();
    return NextResponse.json({ contact: contacts.find((item) => item.id === result.rows[0].id) }, { status: 201 });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'That Instagram creator is already in your tracker.' }, { status: 409 });
    }
    console.error('admin/outreach POST failed:', err);
    return NextResponse.json({ error: 'Could not save that creator.' }, { status: 500 });
  }
}
