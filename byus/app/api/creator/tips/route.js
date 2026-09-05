export const dynamic = 'force-dynamic';

// GET /api/creator/tips
// The signed-in creator's most recent one-time tips (amount + optional message a fan
// left, à la Ko-fi's "leave a message with your coffee"). A tip is any `transactions`
// row with no subscription_id — subscription invoices always have one, tips never do,
// so that's all that distinguishes the two without a separate "type" column.
//
// The message is always shown to the creator regardless of the fan's public-support
// preference — it's private correspondence, not a public credit. The fan's name is only
// included if they've opted into show_support_publicly (same flag gating the "top
// supporters" list on the public profile); otherwise they show up as "A supporter".

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

const RECENT_TIPS_LIMIT = 25;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Creators only.' }, { status: 403 });
  }

  try {
    const result = await query(
      `SELECT t.id, t.gross_amount_cents, t.message, t.created_at,
              u.display_name AS fan_display_name, u.show_support_publicly
       FROM transactions t
       JOIN users u ON u.id = t.fan_id
       WHERE t.creator_id = $1 AND t.subscription_id IS NULL AND t.status = 'succeeded'
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [session.userId, RECENT_TIPS_LIMIT]
    );

    const tips = result.rows.map((row) => ({
      id: row.id,
      amountCents: row.gross_amount_cents,
      message: row.message,
      createdAt: row.created_at,
      fanDisplayName: row.show_support_publicly ? row.fan_display_name : null,
    }));

    return NextResponse.json({ tips });
  } catch (err) {
    console.error('creator/tips GET failed:', err);
    return NextResponse.json({ error: 'Could not load your tips.' }, { status: 500 });
  }
}
