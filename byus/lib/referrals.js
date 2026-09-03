// Shared by every signup path (email/password, Google, Apple) that can create a
// brand-new account. Records that `referredUserId` was referred by whoever owns
// `referralCode`, if the code is real — best-effort and silent on failure, since a
// bad or missing referral code should never be a reason to fail someone's signup.
// The reward itself isn't granted here: this just marks the relationship as
// "pending" so /api/subscribe and the Stripe webhook can grant the free-month
// reward to both sides once the referred person actually subscribes.

import { query } from '@/lib/db';
import stripe from '@/lib/stripe';

export async function attributeReferral(referralCode, referredUserId) {
  if (!referralCode || typeof referralCode !== 'string') return;

  try {
    const referrer = await query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim()]);
    if (referrer.rows[0] && referrer.rows[0].id !== referredUserId) {
      await query('INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)', [
        referrer.rows[0].id,
        referredUserId,
      ]);
    }
  } catch (err) {
    console.error('Referral attribution failed (continuing signup):', err);
  }
}

// One shared, well-known coupon ("100% off, once") rather than minting a fresh Stripe
// coupon object per checkout — keeps the Stripe dashboard readable and means there's
// exactly one place the "first month free" terms live. Fetched lazily and created the
// first time it's needed; every call after that is just a lookup.
const REFERRAL_COUPON_ID = 'referral-first-month-free';

async function ensureReferralCoupon() {
  try {
    await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
  } catch (err) {
    if (err?.code !== 'resource_missing') throw err;
    await stripe.coupons.create({
      id: REFERRAL_COUPON_ID,
      name: 'Referral — first month free',
      percent_off: 100,
      duration: 'once',
    });
  }
  return REFERRAL_COUPON_ID;
}

// Called from /api/subscribe right before creating the Checkout Session. Returns a
// `discounts` array to spread into the session params if this fan has an unrewarded
// referral waiting (their first-ever subscription through a friend's link), or null
// if there's nothing to apply — most subscribe calls hit this second path.
export async function getReferralDiscount(fanUserId) {
  const pending = await query(
    `SELECT id FROM referrals WHERE referred_id = $1 AND status = 'pending' LIMIT 1`,
    [fanUserId]
  );
  if (!pending.rows[0]) return null;

  const couponId = await ensureReferralCoupon();
  return [{ coupon: couponId }];
}

// Called from the Stripe webhook when a fan's checkout.session.completed fires for a
// brand-new subscription. If that fan has a pending referral, marks it rewarded and
// credits the referrer one month's worth of subscription value on their Stripe
// customer balance — applied automatically to whatever they're next billed for. If
// the referrer has never subscribed to anything themselves, a bare customer record is
// created just to hold the credit until they do; it costs nothing to exist.
export async function rewardReferrer({ fanUserId, subscriptionRowId, priceCents }) {
  const pending = await query(
    `SELECT id, referrer_id FROM referrals WHERE referred_id = $1 AND status = 'pending' LIMIT 1`,
    [fanUserId]
  );
  const referral = pending.rows[0];
  if (!referral) return;

  // Guarded by `status = 'pending'` so a duplicate call (there shouldn't be one — the
  // webhook's own processed_stripe_events table already prevents that — but belt and
  // suspenders costs nothing) can never double-credit the same referrer.
  const claimed = await query(
    `UPDATE referrals SET status = 'rewarded', reward_subscription_id = $1, rewarded_at = now()
     WHERE id = $2 AND status = 'pending'
     RETURNING id`,
    [subscriptionRowId, referral.id]
  );
  if (claimed.rows.length === 0) return;

  const referrerResult = await query('SELECT email, stripe_customer_id FROM users WHERE id = $1', [
    referral.referrer_id,
  ]);
  const referrer = referrerResult.rows[0];
  if (!referrer) return;

  let customerId = referrer.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: referrer.email,
      metadata: { user_id: referral.referrer_id },
    });
    customerId = customer.id;
    await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, referral.referrer_id]);
  }

  // A negative amount is a credit — it reduces what they owe on their next invoice
  // rather than charging them.
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -priceCents,
    currency: 'usd',
    description: 'Referral reward — thanks for bringing a friend to ByUs!',
  });
}
