export const dynamic = 'force-dynamic';

// GET  /api/creator/switch-links -> this creator's switching links
// POST /api/creator/switch-links { label, firstChargeDate: 'YYYY-MM-DD', maxUses }
// Links that let fans move over from another platform without paying twice. Rules and
// limits: lib/switch-links.js.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  newSwitchCode,
  SWITCH_MIN_LEAD_DAYS,
  SWITCH_MAX_DAYS,
  SWITCH_MAX_ACTIVE_LINKS,
  SWITCH_MAX_USES,
} from '@/lib/switch-links';

async function listLinks(creatorId) {
  const [links, creator] = await Promise.all([
    query(
      `SELECT id, code, label, first_charge_at, max_uses, uses, active, created_at
       FROM switch_links WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [creatorId]
    ),
    query(`SELECT slug FROM users WHERE id = $1`, [creatorId]),
  ]);
  const base = `${process.env.APP_URL || 'https://byusapp.com'}/creator/${creator.rows[0]?.slug || creatorId}`;
  const leadMs = SWITCH_MIN_LEAD_DAYS * 86400 * 1000;
  return links.rows.map((l) => ({
    ...l,
    url: `${base}?switch=${l.code}`,
    usable: l.active && l.uses < l.max_uses && new Date(l.first_charge_at).getTime() - Date.now() >= leadMs,
  }));
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view switching links.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ links: await listLinks(session.userId) });
  } catch (err) {
    console.error('creator/switch-links GET failed:', err);
    return NextResponse.json({ error: 'Could not load your switching links.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can create switching links.' }, { status: 403 });
  }
  const rateCheck = await checkRateLimit('discount-create', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : '';
  const maxUses = Number(body.maxUses);
  const dateMatch = typeof body.firstChargeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.firstChargeDate);

  if (!label) return NextResponse.json({ error: 'Give the link a name, like “Patreon monthly members”.' }, { status: 400 });
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > SWITCH_MAX_USES) {
    return NextResponse.json({ error: `How many fans are you bringing over? Enter 1 to ${SWITCH_MAX_USES}.` }, { status: 400 });
  }
  if (!dateMatch) return NextResponse.json({ error: 'Pick the date of their first ByUs charge.' }, { status: 400 });

  // Noon UTC on the chosen day, so the date reads the same in every US time zone.
  const firstCharge = new Date(`${body.firstChargeDate}T12:00:00Z`);
  const days = (firstCharge.getTime() - Date.now()) / 86400000;
  if (!Number.isFinite(days) || days < SWITCH_MIN_LEAD_DAYS + 0.5) {
    return NextResponse.json({ error: `The first charge date needs to be at least ${SWITCH_MIN_LEAD_DAYS + 1} days from today.` }, { status: 400 });
  }
  if (days > SWITCH_MAX_DAYS) {
    return NextResponse.json({ error: 'The first charge date can be up to 12 months from today.' }, { status: 400 });
  }

  try {
    const active = await query(
      `SELECT COUNT(*)::int AS n FROM switch_links WHERE creator_id = $1 AND active = true`,
      [session.userId]
    );
    if (active.rows[0].n >= SWITCH_MAX_ACTIVE_LINKS) {
      return NextResponse.json({ error: `You can have ${SWITCH_MAX_ACTIVE_LINKS} active switching links. Turn one off first.` }, { status: 400 });
    }
    await query(
      `INSERT INTO switch_links (creator_id, code, label, first_charge_at, max_uses)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.userId, newSwitchCode(), label, firstCharge.toISOString(), maxUses]
    );
    return NextResponse.json({ links: await listLinks(session.userId) });
  } catch (err) {
    console.error('creator/switch-links POST failed:', err);
    return NextResponse.json({ error: 'Could not create this link. Try again.' }, { status: 500 });
  }
}
