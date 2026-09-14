export const dynamic = 'force-dynamic';

// POST /api/waitlist
// Joins the Founding Creator waitlist: { email, displayName?, source?, referralCode?, website }
//
// Legacy founding-interest endpoint retained for previously submitted forms and historical
// attribution. The public /waitlist page now redirects to normal creator signup because
// Stripe Connect onboarding is open. No account, password, or role is created here.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { sendWaitlistConfirmationEmail } from '@/lib/email';
import { trackServerEvent } from '@/lib/analytics';
import { getWaitlistCount } from '@/lib/waitlist';

// Same permissive check as signup — a sanity check, not full RFC 5322 validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const DISPLAY_NAME_MAX = 100;
const SOURCE_MAX = 60;
const REFERRAL_MAX = 60;

export async function POST(request) {
  const { email, displayName, source, referralCode, website } = await request.json().catch(() => ({}));

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
  const trimmedSource = typeof source === 'string' ? source.trim().slice(0, SOURCE_MAX) : null;
  const trimmedReferral = typeof referralCode === 'string' ? referralCode.trim().slice(0, REFERRAL_MAX) : null;

  const ip = getClientIp(request);
  const rateCheck = await checkRateLimit('waitlist', `ip:${ip}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    // Already on the list — treat it as a success rather than an error. There's nothing
    // sensitive about "this email already applied" the way there is with login, and a
    // visitor who double-submits (or applies again from a different CTA) shouldn't see
    // a scary red error for it.
    const existing = await query('SELECT id FROM founding_waitlist WHERE email = $1', [trimmedEmail]);
    let isNew = existing.rows.length === 0;

    if (isNew) {
      await query(
        `INSERT INTO founding_waitlist (email, display_name, source, referral_code)
         VALUES ($1, $2, $3, $4)`,
        [trimmedEmail, trimmedName || null, trimmedSource, trimmedReferral]
      );
    }

    if (isNew) {
      await trackServerEvent('funnel_waitlist_joined', { source: trimmedSource || 'unknown' }, request);
      // Best-effort — a delivery hiccup shouldn't block someone from joining the list.
      try {
        await sendWaitlistConfirmationEmail(trimmedEmail, { displayName: trimmedName });
      } catch (err) {
        console.error('Waitlist confirmation email failed (continuing):', err);
      }
    }

    const count = await getWaitlistCount(query);
    return NextResponse.json({ ok: true, alreadyApplied: !isNew, count });
  } catch (err) {
    console.error('waitlist POST failed:', err);
    return NextResponse.json({ error: 'Could not join the waitlist. Try again.' }, { status: 500 });
  }
}
