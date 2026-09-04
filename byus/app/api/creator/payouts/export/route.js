export const dynamic = 'force-dynamic';

// GET /api/creator/payouts/export?year=2026
// Downloads the creator's own earnings ledger as a CSV — one row per successful
// invoice, with the platform fee rate and split already worked out. `year` is
// optional; omitted, it exports the full lifetime history. Meant as a paper trail a
// creator can hand to a bookkeeper or use to sanity-check the 1099-K Stripe sends
// them directly (see the route.js in the parent folder for why Stripe, not ByUs, is
// the one issuing that form).

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

// Wraps a field in double quotes only when it contains something that would
// otherwise break CSV parsing, escaping any embedded quotes by doubling them.
function csvField(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return new Response('Creators only.', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;

  try {
    const values = [session.userId];
    let yearClause = '';
    if (year) {
      values.push(String(year));
      yearClause = `AND EXTRACT(YEAR FROM created_at)::text = $2`;
    }

    const result = await query(
      `SELECT created_at, stripe_invoice_id, amount_cents, fee_percent_applied
       FROM creator_earnings
       WHERE creator_id = $1 ${yearClause}
       ORDER BY created_at ASC`,
      values
    );

    const header = [
      'Date',
      'Stripe invoice ID',
      'Gross amount',
      'Platform fee %',
      'Platform fee amount',
      'Net amount (what you were paid)',
    ];
    const lines = [header.map(csvField).join(',')];

    for (const row of result.rows) {
      const grossCents = row.amount_cents;
      const feePercent = row.fee_percent_applied;
      const feeCents = Math.round((grossCents * feePercent) / 100);
      const netCents = grossCents - feeCents;
      lines.push(
        [
          new Date(row.created_at).toISOString().slice(0, 10),
          row.stripe_invoice_id,
          (grossCents / 100).toFixed(2),
          feePercent,
          (feeCents / 100).toFixed(2),
          (netCents / 100).toFixed(2),
        ]
          .map(csvField)
          .join(',')
      );
    }

    const csv = lines.join('\r\n') + '\r\n';
    const filename = year ? `byus-payouts-${year}.csv` : 'byus-payouts-all-time.csv';

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('creator/payouts/export GET failed:', err);
    return new Response('Could not generate your export. Try again.', { status: 500 });
  }
}
