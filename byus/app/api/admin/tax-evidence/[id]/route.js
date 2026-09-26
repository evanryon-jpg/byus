export const dynamic = 'force-dynamic';

// POST /api/admin/tax-evidence/:id -> { confirmedCountry, note }
// Settles a location conflict once the fan has confirmed where they live (HMRC's "contact
// the consumer" step). Records the outcome only: if the confirmed country differs from the
// one Stripe charged tax for, tell the VAT filing service so the return uses the right
// country. The original evidence columns are never changed.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const body = await request.json().catch(() => ({}));
  const country = typeof body.confirmedCountry === 'string' ? body.confirmedCountry.trim().toUpperCase() : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'Enter the two-letter country code the fan confirmed, like GB or FR.' }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json({ error: 'Add a short note on how the fan confirmed it.' }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE tax_location_evidence
       SET status = 'resolved', confirmed_country = $1, resolution_note = $2,
           resolved_by = $3, resolved_at = now()
       WHERE id = $4 AND status = 'conflict'
       RETURNING id, taxed_country`,
      [country, note, session.userId, params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found or already resolved.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, taxedDiffers: result.rows[0].taxed_country !== country });
  } catch (err) {
    console.error('admin/tax-evidence resolve failed:', err);
    return NextResponse.json({ error: 'Could not save this.' }, { status: 500 });
  }
}
