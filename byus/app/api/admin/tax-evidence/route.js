export const dynamic = 'force-dynamic';

// GET /api/admin/tax-evidence            -> { conflicts, recent, stats }
// GET /api/admin/tax-evidence?format=csv -> every evidence row (for the VAT filing service)
// Fan location evidence for UK/EU VAT (lib/tax-location-evidence.js). Admin-only: rows
// include fans' IP addresses. Gated by lib/admin.js's allowlist.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const COLUMNS = `e.id, e.stripe_charge_id, e.stripe_invoice_id, e.payment_kind, e.amount_cents, e.tax_cents,
  e.billing_country, e.card_country, e.ip_country, e.ip_address, e.ip_captured_at,
  e.resolved_country, e.taxed_country, e.status, e.conflict_reason, e.confirmed_country,
  e.resolution_note, e.resolved_at, e.paid_at,
  f.display_name AS fan_name, f.email AS fan_email, c.display_name AS creator_name`;

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const rateCheck = await checkRateLimit('admin-read', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const format = new URL(request.url).searchParams.get('format');
    if (format === 'csv') {
      const { rows } = await query(
        `SELECT ${COLUMNS} FROM tax_location_evidence e
         LEFT JOIN users f ON f.id = e.fan_id LEFT JOIN users c ON c.id = e.creator_id
         ORDER BY e.paid_at`
      );
      const header = ['paid_at', 'stripe_charge_id', 'stripe_invoice_id', 'payment_kind', 'amount_cents', 'tax_cents',
        'billing_country', 'card_country', 'ip_country', 'ip_address', 'resolved_country', 'taxed_country',
        'status', 'confirmed_country', 'resolution_note', 'fan_email', 'creator_name'];
      const body = [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n');
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="byus-fan-location-evidence-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const [conflicts, recent, stats] = await Promise.all([
      query(
        `SELECT ${COLUMNS} FROM tax_location_evidence e
         LEFT JOIN users f ON f.id = e.fan_id LEFT JOIN users c ON c.id = e.creator_id
         WHERE e.status = 'conflict' ORDER BY e.paid_at ASC LIMIT 200`
      ),
      query(
        `SELECT ${COLUMNS} FROM tax_location_evidence e
         LEFT JOIN users f ON f.id = e.fan_id LEFT JOIN users c ON c.id = e.creator_id
         WHERE e.status <> 'conflict' ORDER BY e.paid_at DESC LIMIT 50`
      ),
      query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE paid_at >= now() - interval '30 days')::int AS last30,
                COUNT(*) FILTER (WHERE status = 'conflict')::int AS open_conflicts,
                COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
                COUNT(*) FILTER (WHERE resolved_country IN ('GB','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'))::int AS uk_eu
         FROM tax_location_evidence`
      ),
    ]);
    return NextResponse.json({ conflicts: conflicts.rows, recent: recent.rows, stats: stats.rows[0] });
  } catch (err) {
    console.error('admin/tax-evidence GET failed:', err);
    return NextResponse.json({ error: 'Could not load location evidence.' }, { status: 500 });
  }
}
