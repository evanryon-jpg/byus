export const dynamic = 'force-dynamic';

// GET /api/me/referral
// Returns the current user's referral link (generating a referral_code the first
// time they ask for one) plus simple stats: how many people signed up through it,
// and how many of those have gone on to pay for a subscription and triggered the
// free-month reward for both sides. See lib/referrals.js and /api/subscribe for
// where a referral gets created and rewarded.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

// Avoids visually ambiguous characters (0/O, 1/I/L) since this code gets typed,
// texted, and read off a screen by real people, not just pasted from a link.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

// Collisions are vanishingly unlikely at this alphabet/length (32^8), but a couple
// of retries costs nothing and turns "vanishingly unlikely" into "effectively never".
async function assignReferralCode(userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const result = await query(
        'UPDATE users SET referral_code = $1 WHERE id = $2 RETURNING referral_code',
        [code, userId]
      );
      return result.rows[0].referral_code;
    } catch (err) {
      if (err?.code === '23505') continue; // unique_violation — try another code
      throw err;
    }
  }
  throw new Error('Could not generate a unique referral code.');
}

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  try {
    const userResult = await query('SELECT referral_code FROM users WHERE id = $1', [session.userId]);
    let referralCode = userResult.rows[0]?.referral_code;
    if (!referralCode) {
      referralCode = await assignReferralCode(session.userId);
    }

    const statsResult = await query(
      `SELECT
         count(*)::int AS referred_count,
         count(*) FILTER (WHERE status = 'rewarded')::int AS rewarded_count
       FROM referrals
       WHERE referrer_id = $1`,
      [session.userId]
    );
    const stats = statsResult.rows[0] || { referred_count: 0, rewarded_count: 0 };

    // request.url's own origin, same as every OAuth route does — headers.get('origin')
    // isn't reliably sent on a same-origin GET, so it's not a safe source here.
    const { origin } = new URL(request.url);
    const referralLink = `${origin}/signup?ref=${referralCode}`;

    return NextResponse.json({
      referralCode,
      referralLink,
      referredCount: stats.referred_count,
      rewardedCount: stats.rewarded_count,
    });
  } catch (err) {
    console.error('me/referral GET failed:', err);
    return NextResponse.json({ error: 'Could not load your referral link. Try again.' }, { status: 500 });
  }
}
