export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { trackServerEvent } from '@/lib/analytics';
import {
  STANDARD_FEE_PERCENT,
  DISCOUNTED_FEE_PERCENT,
  FOUNDING_CREATOR_LIMIT,
} from '@/lib/pricing';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { CREATOR_SIGNUP_PAUSED, CREATOR_SIGNUP_PAUSED_MESSAGE } from '@/lib/creator-signup';

// Upgrades a fan-only account to a creator account. Because the current schema stores one
// role per account, protect fans with subscription history from losing billing access.
export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  }

  const rateCheck = await checkRateLimit('become-creator', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  // Same gate as creator signup (app/api/auth/signup and the OAuth start routes): while
  // new creator accounts are paused, a fan can't upgrade into one either. Without this, any
  // fan could become a creator -- and claim a founding spot -- during the pause.
  if (CREATOR_SIGNUP_PAUSED && session.role !== 'creator') {
    return NextResponse.json({ error: CREATOR_SIGNUP_PAUSED_MESSAGE }, { status: 403 });
  }

  try {
    let upgraded = false;
    const user = await withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'))`);

      const currentResult = await client.query(
        `SELECT id, email, role, session_version FROM users WHERE id = $1 FOR UPDATE`,
        [session.userId]
      );
      const current = currentResult.rows[0];
      if (!current) return null;
      if (current.role === 'creator') return current;

      const subscriptionResult = await client.query(
        'SELECT 1 FROM subscriptions WHERE fan_id = $1 LIMIT 1',
        [current.id]
      );
      if (subscriptionResult.rows.length > 0) {
        const error = new Error('FAN_SUBSCRIPTION_HISTORY');
        error.code = 'FAN_SUBSCRIPTION_HISTORY';
        throw error;
      }

      const updated = await client.query(
        `UPDATE users
         SET role = 'creator',
             platform_fee_percent = (
               CASE
                 WHEN (SELECT COUNT(*) FROM users WHERE role = 'creator') < $2 THEN $3
                 ELSE $4
               END
             )::integer,
             updated_at = now()
         WHERE id = $1
         RETURNING id, email, role, session_version`,
        [current.id, FOUNDING_CREATOR_LIMIT, DISCOUNTED_FEE_PERCENT, STANDARD_FEE_PERCENT]
      );
      upgraded = true;
      return updated.rows[0];
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const response = NextResponse.json({ user, destination: '/creator/dashboard' });
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), getSessionCookieOptions());
    if (upgraded) {
      await trackServerEvent('funnel_fan_became_creator', { role: 'creator' }, request);
    }
    return response;
  } catch (error) {
    if (error?.code === 'FAN_SUBSCRIPTION_HISTORY') {
      return NextResponse.json(
        {
          error: 'This account has subscription history. Contact support so we can add creator access without affecting your billing.',
        },
        { status: 409 }
      );
    }
    console.error('become-creator failed:', error);
    return NextResponse.json(
      { error: 'Could not switch this account to a creator account. Try again.' },
      { status: 500 }
    );
  }
}
