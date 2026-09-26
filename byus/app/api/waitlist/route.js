export const dynamic = 'force-dynamic';

// POST /api/waitlist
// Joins the Founding Creator waitlist: { email, displayName?, source?, referralCode?, website }
//
// Creator signup is paused again as of Sep 2026 (unrelated Stripe account review), so
// app/signup/page.js posts here directly when role === 'creator' instead of creating an
// account. No account, password, or role is created by this endpoint either way.

import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { sendWaitlistConfirmationEmail, sendNewWaitlistSignupEmail } from '@/lib/email';
import { getAdminEmails } from '@/lib/admin';
import { getFoundingPromoStats } from '@/lib/fees';
import { trackServerEvent } from '@/lib/analytics';
import { getWaitlistCount } from '@/lib/waitlist';
import { isCreatorCountryCode, creatorCountryStatus, creatorCountryName } from '@/lib/creator-countries';

// Same permissive check as signup — a sanity check, not full RFC 5322 validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const DISPLAY_NAME_MAX = 100;
const SOURCE_MAX = 60;
const REFERRAL_MAX = 60;

// GET /api/waitlist -> { limit, claimed, remaining, nextSpot }
// Same numbers the homepage grid shows (lib/fees.js getFoundingPromoStats); the creator
// waitlist form on /signup uses nextSpot to say "Reserve founding spot #N of 50".
export async function GET() {
  try {
    const stats = await getFoundingPromoStats(query);
    return NextResponse.json(
      { ...stats, nextSpot: stats.remaining > 0 ? stats.claimed + 1 : null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('waitlist GET failed:', err);
    return NextResponse.json({ error: 'Unavailable.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { email, displayName, source, referralCode, website, country } = await request.json().catch(() => ({}));

  // --- Honeypot --- same pattern as /api/auth/signup: respond like a normal success so
  // a bot filling every field it can find never learns which one was the trap.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!trimmedEmail || trimmedEmail.length > EMAIL_MAX || !EMAIL_RE.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const trimmedName = typeof displayName === 'string' ? displayName.trim() : '';
  if (trimmedName.length > DISPLAY_NAME_MAX) {
    return NextResponse.json(
      { error: `Name must be ${DISPLAY_NAME_MAX} characters or fewer.` },
      { status: 400 }
    );
  }
  // Required on the form since Sept 26, 2026 (lib/creator-countries.js). Older clients that
  // don't send it are treated as US, same as rows from before the column existed.
  if (country !== undefined && country !== null && !isCreatorCountryCode(country)) {
    return NextResponse.json({ error: 'Choose the country you live in.' }, { status: 400 });
  }
  const countryCode = country || null;
  const countryStatus = creatorCountryStatus(countryCode);
  const trimmedSource = typeof source === 'string' ? source.trim().slice(0, SOURCE_MAX) : null;
  const trimmedReferral = typeof referralCode === 'string' ? referralCode.trim().slice(0, REFERRAL_MAX) : null;

  const ip = getClientIp(request);
  const rateCheck = await checkRateLimit('waitlist', `ip:${ip}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const { isNew, foundingSpot } = await withTransaction(async (client) => {
      // Shared with account creation: one email, one spot, no concurrent oversubscription.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'))");
      const inserted = await client.query(
        `INSERT INTO founding_waitlist (email, display_name, source, referral_code, country)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING RETURNING id`,
        [trimmedEmail, trimmedName || null, trimmedSource, trimmedReferral, countryCode]
      );
      // Countries ByUs can't pay creators in join the list without taking one of the 50
      // spots (same rule as the insert trigger). Everyone else reserves -- or gets back the
      // spot they already hold if this email was already on the list.
      if (countryStatus === 'unsupported') {
        const existing = await client.query(
          'SELECT spot_number FROM founding_reservations WHERE email = $1',
          [trimmedEmail]
        );
        return { isNew: inserted.rows.length > 0, foundingSpot: existing.rows[0]?.spot_number ?? null };
      }
      const reserved = await client.query('SELECT reserve_founding_spot($1) AS spot', [trimmedEmail]);
      return { isNew: inserted.rows.length > 0, foundingSpot: reserved.rows[0].spot };
    });

    if (isNew) {
      await trackServerEvent('funnel_waitlist_joined', { source: trimmedSource || 'unknown' }, request);
      // Best-effort — a delivery hiccup shouldn't block someone from joining the list.
      try {
        await sendWaitlistConfirmationEmail(trimmedEmail, { displayName: trimmedName, foundingSpot, country: countryCode });
      } catch (err) {
        console.error('Waitlist confirmation email failed (continuing):', err);
      }
      // Tell the admin right away. Same best-effort rule: never fail the join over it.
      try {
        const foundingStats = await getFoundingPromoStats(query).catch(() => null);
        await sendNewWaitlistSignupEmail(getAdminEmails(), {
          email: trimmedEmail,
          displayName: trimmedName,
          foundingSpot,
          foundingStats,
          country: creatorCountryName(countryCode),
          adminUrl: process.env.APP_URL ? `${process.env.APP_URL}/admin` : null,
        });
      } catch (err) {
        console.error('New waitlist signup admin email failed (continuing):', err);
      }
    }

    const count = await getWaitlistCount(query);
    return NextResponse.json({ ok: true, alreadyApplied: !isNew, count, foundingSpot, countryStatus });
  } catch (err) {
    console.error('waitlist POST failed:', err);
    return NextResponse.json({ error: 'Could not join the waitlist. Try again.' }, { status: 500 });
  }
}
