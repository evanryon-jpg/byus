export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { loadOutreachContacts } from '@/lib/admin-data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['planned', 'messaged', 'replied', 'interested', 'not_interested']);

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
      result = await query(
        `UPDATE outreach_contacts
         SET status = 'messaged',
             messaged_at = now(),
             follow_up_due_at = now() + interval '7 days',
             followed_up_at = NULL,
             updated_at = now()
         WHERE id = $1
         RETURNING id`,
        [params.id]
      );
    } else if (body.action === 'mark_followed_up') {
      result = await query(
        `UPDATE outreach_contacts
         SET followed_up_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id`,
        [params.id]
      );
    } else if (STATUSES.has(body.status)) {
      result = await query(
        `UPDATE outreach_contacts SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
        [body.status, params.id]
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
    console.error('admin/outreach PATCH failed:', err);
    return NextResponse.json({ error: 'Could not update that creator.' }, { status: 500 });
  }
}
