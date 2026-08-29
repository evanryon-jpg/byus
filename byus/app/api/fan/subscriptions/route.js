export const dynamic = 'force-dynamic';

// GET /api/fan/subscriptions
// The logged-in fan's own subscriptions, with creator/tier info joined in for display.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can view this.' }, { status: 403 });
  }

  try {
    const result = await query(
      `SELECT s.id, s.status, s.current_period_end,
              u.display_name AS creator_name, u.id AS creator_id,
              t.name AS tier_name, t.price_cents
       FROM subscriptions s
       JOIN users u ON u.id = s.creator_id
       JOIN subscription_tiers t ON t.id = s.tier_id
       WHERE s.fan_id = $1
       ORDER BY s.created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ subscriptions: result.rows });
  } catch (err) {
    console.error('fan/subscriptions GET failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not load your subscriptions. Try again.' },
      { status: 500 }
    );
  }
}
