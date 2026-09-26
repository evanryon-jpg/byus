// Personal tier -- founding creators stay at DISCOUNTED_FEE_PERCENT permanently. Other
// creators start each calendar month at STANDARD_FEE_PERCENT and move to
// DISCOUNTED_FEE_PERCENT for the rest of that month after their gross ByUs earnings reach
// FEE_DISCOUNT_THRESHOLD_CENTS. The first payment that crosses the threshold is recorded
// at the rate it was actually charged; the lower rate is then synced to future charges.
//
// There used to be a second, stacking discount here -- a platform-wide milestone bonus
// that lowered every creator's fee further as ByUs's own revenue grew. It's retired:
// DISCOUNTED_FEE_PERCENT (10%) is the lowest advertised rate and covers Stripe's own
// processing, Connect account, and payout fees (see lib/stripe.js), so there was no room
// left to stack anything on top of it. getPlatformMilestoneReductionPoints() below always
// returns 0 now, making applyPlatformMilestoneReduction() a no-op everywhere it's still
// called -- kept as a no-op rather than ripped out so every call site (subscribe route,
// /api/me, creator earnings) keeps working unchanged. The `platform_milestones` table and
// its crossings live on purely as a celebratory "best month so far" stat on the homepage
// gauge -- see app/components/PlatformGoalGauge.jsx -- with no effect on billing.
//
// The personal-tier crossing is detected inside the Stripe webhook (see
// app/api/webhooks/stripe/route.js, case 'invoice.payment_succeeded'), the only place a
// payment is confirmed to have actually happened. The Stripe API call that follows a
// crossing (re-pointing that one creator's live subscriptions at the new rate) runs AFTER
// the DB transaction commits -- same split, and same reasoning, the webhook already uses
// for referral rewards. There is no platform-wide equivalent anymore: since the milestone
// reduction above is retired (always 0), a platform milestone crossing has nothing left to
// resync -- see syncActiveSubscriptionsToFeePercent below for the one Stripe sync that's
// still live.

import { query } from './db';
import { paymentProvider } from './payments';
import {
  STANDARD_FEE_PERCENT,
  DISCOUNTED_FEE_PERCENT,
  FEE_DISCOUNT_THRESHOLD_CENTS,
  MIN_FEE_PERCENT,
  FOUNDING_CREATOR_LIMIT,
} from './pricing';
import { rewardCreatorReferrerLaunch } from './referrals';

// Permanent founding number, reserved on the waitlist or at creator signup.
export async function getFoundingCreatorRank(queryFn, creatorId) {
  const result = await queryFn(
    'SELECT spot_number AS rank FROM founding_reservations WHERE creator_id = $1',
    [creatorId]
  );
  return result.rows[0] ? Number(result.rows[0].rank) : null;
}

export async function isFoundingCreator(queryFn, creatorId) {
  const rank = await getFoundingCreatorRank(queryFn, creatorId);
  return rank !== null && rank <= FOUNDING_CREATOR_LIMIT;
}

// Includes both claimed creator accounts and reserved waitlist places.
export async function getFoundingPromoStats(queryFn) {
  const result = await queryFn('SELECT COUNT(*)::int AS count FROM founding_reservations');
  const claimed = Math.min(result.rows[0].count, FOUNDING_CREATOR_LIMIT);
  return { limit: FOUNDING_CREATOR_LIMIT, claimed, remaining: FOUNDING_CREATOR_LIMIT - claimed };
}

const MILESTONE_POINTS_SQL = `
  SELECT COALESCE(SUM(reduction_points), 0)::int AS points
  FROM platform_milestones WHERE crossed_at IS NOT NULL`;

// Retired: platform-wide milestones no longer reduce anyone's fee. 10% (== the existing
// personal-tier rate, and == MIN_FEE_PERCENT in lib/stripe.js) is the sustainable floor --
// Stripe's own processing, Connect account, and payout fees come out of ByUs's side of
// every charge, and stacking further reductions on top of the personal tier didn't leave
// enough margin to cover that. Always returns 0, so every applyPlatformMilestoneReduction
// call below is a no-op and every creator is billed their personal-tier rate, full stop.
// The `platform_milestones` table and its crossings still feed the homepage gauge as a
// celebratory "best month so far" stat -- see app/components/PlatformGoalGauge.jsx and
// checkPlatformMilestones() below -- they just no longer touch billing. `queryFn` is kept
// as a parameter, unused, so every call site below still works without changes.
export async function getPlatformMilestoneReductionPoints(queryFn) {
  return 0;
}

// A creator's actual, chargeable fee: their personal-tier rate minus the platform's
// current milestone bonus, floored at MIN_FEE_PERCENT. A base of 0 is the creator-referral
// "0% fee month" (lib/referrals.js rewardCreatorReferrerLaunch) and passes through as 0 --
// the floor exists to stop stacked discounts eroding the standard tiers, not to cancel a
// promo that is deliberately 0. Flooring it used to charge promo creators 10% while their
// dashboard showed 0%.
export function applyPlatformMilestoneReduction(basePercent, reductionPoints) {
  if (Number(basePercent) === 0) return 0;
  return Math.max(MIN_FEE_PERCENT, basePercent - reductionPoints);
}

// The fee to put on a NEW checkout (subscribe, tip, product). Same as the stored
// platform_fee_percent except for one case: a 0 left over from a referral 0%-fee month
// that has since lapsed. The column only moves off 0 on the creator's next earning (or the
// monthly reset), so without this check the first checkouts after the promo ended would
// still carry no platform fee. Falls back to the rate the monthly reset would assign
// (founding -> discounted, otherwise standard); the next earning re-evaluates properly.
export async function chargeableFeePercent({ creatorId, platformFeePercent, zeroFeePromoExpiresAt }) {
  let base = Number(platformFeePercent);
  if (base === 0) {
    const promoActive = Boolean(zeroFeePromoExpiresAt) && new Date(zeroFeePromoExpiresAt) > new Date();
    if (!promoActive) {
      base = (await isFoundingCreator(query, creatorId)) ? DISCOUNTED_FEE_PERCENT : STANDARD_FEE_PERCENT;
    }
  }
  const reductionPoints = await getPlatformMilestoneReductionPoints(query);
  return applyPlatformMilestoneReduction(base, reductionPoints);
}

// Runs inside the webhook's DB transaction (`client` is that transaction's connection).
// Records this invoice's payment in the ledger — idempotent on stripe_invoice_id, a
// belt-and-suspenders guard on top of the webhook's own per-event idempotency claim —
// stamped with the EFFECTIVE rate actually charged (personal tier minus whatever
// milestone bonus already existed before this invoice), so historical net-earnings math
// stays accurate no matter how either discount moves later. Then re-checks the creator's
// personal tier (founding/standard, plus any active referral promo) and the platform-wide
// milestone crossings this payment might have triggered. Also checks whether this is the
// creator's very first-ever earning -- their page's "launch", for the creator-referral
// promo below -- and grants their referrer (if any, and if that referrer is themselves a
// creator) a full month at 0% fee. Returns null when nothing changed (duplicate delivery,
// not a creator, or none of the three discounts moved), otherwise
// `{ personalTierChange, crossedMilestones, referrerFeeGranted }` — personalTierChange is
// the creator's new personal-tier percent when their 0%-promo starts or lapses, or when
// their current-month earnings cross the $2,000 tier; otherwise null. crossedMilestones is
// the list of platform milestones (if any) newly crossed by this payment; referrerFeeGranted
// is the referrer's user id when this invoice just launched them a free 0%-fee month (null
// otherwise). The caller syncs
// whichever of those actually happened to Stripe once the transaction is safely committed.
export async function recordEarningAndCheckFeeTier(client, { creatorId, stripeInvoiceId, amountCents }) {
  if (!creatorId || !stripeInvoiceId || !(amountCents > 0)) return null;

  // Lock the creator's row before recording anything, so two of their invoices landing in
  // overlapping webhook deliveries can't both read the pre-crossing total and both think
  // they're the one that needs to flip their personal tier.
  const creatorResult = await client.query(
    `SELECT platform_fee_percent, zero_fee_promo_expires_at FROM users WHERE id = $1 FOR UPDATE`,
    [creatorId]
  );
  const currentFeePercent = creatorResult.rows[0]?.platform_fee_percent;
  if (currentFeePercent === undefined) return null; // not a creator row

  // The rate actually billed on this invoice is the personal tier minus whatever
  // milestone bonus was ALREADY in effect when Stripe charged it — read before this
  // invoice's own contribution can cross a brand-new milestone, since that wouldn't have
  // been applied yet at charge time.
  const reductionPoints = await getPlatformMilestoneReductionPoints(client.query.bind(client));
  const effectiveFeePercent = applyPlatformMilestoneReduction(currentFeePercent, reductionPoints);

  const inserted = await client.query(
    `INSERT INTO creator_earnings (creator_id, stripe_invoice_id, amount_cents, fee_percent_applied)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_invoice_id) DO NOTHING
     RETURNING id`,
    [creatorId, stripeInvoiceId, amountCents, effectiveFeePercent]
  );
  if (inserted.rows.length === 0) return null; // already recorded — redelivered event

  // If this is the very first row this creator has ever recorded, their page just "launched"
  // in the sense the creator-referral promo cares about (a real, paid supporter -- not just
  // a completed signup form) -- see lib/referrals.js for the reward this grants, if anyone
  // referred them and that referrer is themselves a creator.
  const totalEarningsRowsResult = await client.query(
    `SELECT COUNT(*)::int AS n FROM creator_earnings WHERE creator_id = $1`,
    [creatorId]
  );
  const isFirstEverEarning = Number(totalEarningsRowsResult.rows[0].n) === 1;
  const referrerFeeGranted = isFirstEverEarning ? await rewardCreatorReferrerLaunch(client, creatorId) : null;

  // Highest priority: a still-active "invite a creator friend" 0%-fee month (see
  // lib/referrals.js) beats everything else below, including the founding rate. Once it
  // lapses, this naturally falls through to the founding/standard tiers on whichever
  // invoice comes next -- no separate revert job needed.
  const zeroFeePromoActive =
    creatorResult.rows[0].zero_fee_promo_expires_at &&
    new Date(creatorResult.rows[0].zero_fee_promo_expires_at) > new Date();
  const [founding, monthToDateResult] = await Promise.all([
    isFoundingCreator(client.query.bind(client), creatorId),
    client.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS gross_cents
       FROM creator_earnings
       WHERE creator_id = $1
         AND created_at >= date_trunc('month', now())`,
      [creatorId]
    ),
  ]);
  const monthToDateCents = Number(monthToDateResult.rows[0].gross_cents);
  const targetFeePercent = zeroFeePromoActive
    ? 0
    : founding || monthToDateCents >= FEE_DISCOUNT_THRESHOLD_CENTS
    ? DISCOUNTED_FEE_PERCENT
    : STANDARD_FEE_PERCENT;

  let personalTierChange = null;
  if (targetFeePercent !== currentFeePercent) {
    await client.query('UPDATE users SET platform_fee_percent = $1 WHERE id = $2', [
      targetFeePercent,
      creatorId,
    ]);
    personalTierChange = targetFeePercent;
  }

  const crossedMilestones = await checkPlatformMilestones(client);

  if (personalTierChange === null && crossedMilestones.length === 0 && !referrerFeeGranted) return null;
  return { personalTierChange, crossedMilestones, referrerFeeGranted };
}

// Checks whether ByUs's own BEST CALENDAR MONTH of fee income -- summed across every
// creator's earnings for whichever month was highest, using the effective rate actually
// applied to each invoice -- has just crossed one or more platform milestones. Runs
// inside the same transaction as the earnings insert that might have pushed it over. The
// inner query groups by month and takes the max, which naturally includes the current
// (still accumulating) month, so a milestone can be crossed mid-month. The
// UPDATE ... WHERE crossed_at IS NULL is what makes each milestone crossable exactly once
// (two payments landing at nearly the same instant can't both claim it) -- no separate row
// lock needed. Returns the milestones (if any) newly crossed by this call.
async function checkPlatformMilestones(client) {
  const peakResult = await client.query(
    `SELECT COALESCE(MAX(month_total), 0)::bigint AS peak
     FROM (
       SELECT ROUND(SUM(amount_cents * fee_percent_applied) / 100.0) AS month_total
       FROM creator_earnings
       GROUP BY date_trunc('month', created_at)
     ) monthly`
  );
  const platformBestMonthCents = Number(peakResult.rows[0].peak);

  const crossedResult = await client.query(
    `UPDATE platform_milestones
     SET crossed_at = now()
     WHERE crossed_at IS NULL AND threshold_cents <= $1
     RETURNING threshold_cents, reduction_points`,
    [platformBestMonthCents]
  );
  return crossedResult.rows.map((row) => ({
    thresholdCents: Number(row.threshold_cents),
    reductionPoints: row.reduction_points,
  }));
}

// Best-effort, run AFTER the DB transaction that called recordEarningAndCheckFeeTier has
// committed: re-points every one of the creator's currently active (or past_due — still
// billing, just recovering from a card issue) Stripe subscriptions at their new effective
// rate (their just-changed personal tier, minus the platform's current milestone bonus),
// so existing subscribers move to the discounted rate too, not just anyone who subscribes
// after the crossing. A failure here is logged, not thrown — our own database has already
// recorded the discount, so nothing about the crossing itself is lost; a subscription that
// misses this sync would just keep billing at the old rate until fixed by hand, which is
// rare enough and low-stakes enough (a creator who's still growing, being slightly
// overcharged on ByUs's side of the split rather than shorted) not to need a retry queue.
export async function syncActiveSubscriptionsToFeePercent(creatorId, personalTierFeePercent) {
  const reductionPoints = await getPlatformMilestoneReductionPoints(query);
  const effectiveFeePercent = applyPlatformMilestoneReduction(personalTierFeePercent, reductionPoints);

  const subsResult = await query(
    `SELECT stripe_subscription_id FROM subscriptions
     WHERE creator_id = $1 AND status IN ('active', 'past_due')`,
    [creatorId]
  );
  for (const { stripe_subscription_id } of subsResult.rows) {
    try {
      await paymentProvider.updateSubscriptionFeePercent({
        subscriptionId: stripe_subscription_id,
        feePercent: effectiveFeePercent,
      });
    } catch (err) {
      console.error(`Failed to sync application_fee_percent for subscription ${stripe_subscription_id}:`, err);
    }
  }
}

// Runs at the start of each UTC calendar month. Founding creators return to their
// permanent 10% rate, while non-founding creators return to 13% until they reach the
// monthly earnings threshold again. Active referral promos remain at 0%. Updating Stripe
// after the database write keeps existing recurring subscriptions aligned with the rate
// shown in ByUs; failures are already isolated per subscription by the sync helper.
export async function resetMonthlyEarnedFeeTiers() {
  const changed = await query(
    `WITH desired AS (
       SELECT u.id,
              CASE WHEN fr.creator_id IS NOT NULL THEN $1 ELSE $2 END::integer AS fee_percent
       FROM users u
       LEFT JOIN founding_reservations fr ON fr.creator_id = u.id
       WHERE u.role = 'creator'
         AND (u.zero_fee_promo_expires_at IS NULL OR u.zero_fee_promo_expires_at <= now())
     )
     UPDATE users u
     SET platform_fee_percent = desired.fee_percent, updated_at = now()
     FROM desired
     WHERE u.id = desired.id AND u.platform_fee_percent <> desired.fee_percent
     RETURNING u.id, u.platform_fee_percent`,
    [DISCOUNTED_FEE_PERCENT, STANDARD_FEE_PERCENT]
  );

  for (const creator of changed.rows) {
    await syncActiveSubscriptionsToFeePercent(creator.id, creator.platform_fee_percent);
  }
  return changed.rows.length;
}
