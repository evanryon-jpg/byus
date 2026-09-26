export const dynamic = 'force-dynamic';

// GET /api/creator/export/members
// Downloads the creator's current member list as a CSV: name, email, tier, billing
// status, member since, and when the current paid period ends. Only people with a
// live membership are included (active, trialing, or a payment being retried);
// people who have left are not, so a former member's email doesn't keep travelling
// with the creator. How creators may use this list is set out in the creator terms
// (section 5), and fans are told about it in the privacy policy (section 3).

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { csvDocument, csvResponse } from '@/lib/csv';

function day(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

const STATUS_LABELS = {
  active: 'Active',
  trialing: 'Free period',
  past_due: 'Payment being retried',
};

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return new Response('Creators only.', { status: 403 });
  }

  try {
    const result = await query(
      `SELECT DISTINCT ON (s.fan_id)
              u.display_name, u.email, t.name AS tier_name, t.price_cents,
              s.status, s.created_at, s.current_period_end
       FROM subscriptions s
       JOIN users u ON u.id = s.fan_id
       LEFT JOIN subscription_tiers t ON t.id = s.tier_id
       WHERE s.creator_id = $1
         AND s.status IN ('active', 'trialing', 'past_due')
       ORDER BY s.fan_id, s.created_at DESC`,
      [session.userId]
    );

    const rows = result.rows
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((row) => [
        row.display_name || '',
        row.email || '',
        row.tier_name || '',
        row.price_cents != null ? (row.price_cents / 100).toFixed(2) : '',
        STATUS_LABELS[row.status] || row.status,
        day(row.created_at),
        day(row.current_period_end),
      ]);

    const csv = csvDocument(
      ['Name', 'Email', 'Tier', 'Monthly tier price', 'Status', 'Member since', 'Paid through'],
      rows
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(csv, `byus-members-${stamp}.csv`);
  } catch (err) {
    console.error('creator/export/members GET failed:', err);
    return new Response('Could not build your member list. Try again.', { status: 500 });
  }
}
