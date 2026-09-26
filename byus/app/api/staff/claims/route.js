export const dynamic = 'force-dynamic';

// GET  /api/staff/claims -> { me, claims: [{ item_type, item_id, user_id, name, claimed_at }] }
// POST /api/staff/claims { itemType, itemId, action: 'claim' | 'release' | 'takeover' }
// The "I'm on it" button on support desk items (app/components/StaffClaim.jsx). Open to
// support staff and admins (lib/admin.js isSupportStaff). A claim older than CLAIM_HOURS
// counts as unclaimed. Table: database/migrations/20260926d_staff_claims.sql.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isSupportStaff } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const CLAIM_HOURS = 12;
const TYPES = new Set(['video', 'report', 'support']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listClaims() {
  const { rows } = await query(
    `SELECT c.item_type, c.item_id, c.user_id, c.claimed_at,
            COALESCE(NULLIF(split_part(u.display_name, ' ', 1), ''), split_part(u.email, '@', 1)) AS name
     FROM staff_claims c
     JOIN users u ON u.id = c.user_id
     WHERE c.claimed_at > now() - ($1 || ' hours')::interval`,
    [String(CLAIM_HOURS)]
  );
  return rows;
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isSupportStaff(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ me: session.userId, claims: await listClaims() });
  } catch (err) {
    console.error('staff/claims GET failed:', err);
    return NextResponse.json({ error: 'Could not load claims.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || !isSupportStaff(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { itemType, itemId, action } = await request.json().catch(() => ({}));
  if (!TYPES.has(itemType) || typeof itemId !== 'string' || !UUID.test(itemId)) {
    return NextResponse.json({ error: 'Unknown item.' }, { status: 400 });
  }

  try {
    if (action === 'release') {
      await query(
        `DELETE FROM staff_claims WHERE item_type = $1 AND item_id = $2 AND user_id = $3`,
        [itemType, itemId, session.userId]
      );
    } else if (action === 'claim' || action === 'takeover') {
      // A plain claim only wins if nobody holds a live claim (or it's already yours);
      // takeover always wins, for when a teammate is away and the item can't wait.
      const result = await query(
        `INSERT INTO staff_claims (item_type, item_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (item_type, item_id) DO UPDATE
           SET user_id = EXCLUDED.user_id, claimed_at = now()
           WHERE $4::boolean
              OR staff_claims.user_id = EXCLUDED.user_id
              OR staff_claims.claimed_at <= now() - ($5 || ' hours')::interval
         RETURNING user_id`,
        [itemType, itemId, session.userId, action === 'takeover', String(CLAIM_HOURS)]
      );
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Someone else is already on this.', claims: await listClaims(), me: session.userId },
          { status: 409 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Choose claim, release or takeover.' }, { status: 400 });
    }
    return NextResponse.json({ me: session.userId, claims: await listClaims() });
  } catch (err) {
    console.error('staff/claims POST failed:', err);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }
}
