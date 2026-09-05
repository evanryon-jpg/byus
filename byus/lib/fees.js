// One fee discount, re-evaluated every month:
//
// Personal tier -- every creator starts at STANDARD_FEE_PERCENT; for any calendar month
// their earnings on ByUs reach FEE_DISCOUNT_THRESHOLD_CENTS, their own stored rate
// (`users.platform_fee_percent`) drops to DISCOUNTED_FEE_PERCENT for the rest of that month.
// It moves back to STANDARD_FEE_PERCENT as soon as a new month starts without crossing the
// threshold again -- this is a month-to-month rate, not a one-time lifetime unlock, so a
// creator trickling to $2,000 over a full year no longer locks in a permanent discount that
// doesn't match their actual volume.
//
// There used to be a second, stacking discount here -- a platform-wide milestone bonus
// that lowered every creator's fee further as ByUs's own revenue grew. It's retired:
// DISCOUNTED_FEE_PERCENT (7%) is already the lowest rate that reliably covers Stripe's own
// processing, Connect account, and payout fees (see lib/stripe.js), so there was no room
// left to stack anything on top of it. getPlatformMilestoneReductionPoints() below always
// returns 0 now, making applyPlatformMilestoneReduction() a no-op everywhere it's still
// called -- kept as a no-op rather than ripped out so every call site (subscribe route,
// /api/me, creator earnings) keeps working unchanged. The `platform_milestones` table and
// its crossings live on purely as a celebratory "best month so far" stat on the homepage
// gauge -- see app/components/PlatformGoalGauge.jsx -- with no effect on billing.
//
// Both crossings are detected inside the Stripe webhook (see
// app/api/webhooks/stripe/route.js, case 'invoice.payment_succeeded'), the only place a
// payment is confirmed to have actually happened. Stripe API calls that follow a crossing
// (re-pointing live subscriptions at the new rate) run AFTER the DB transaction commits --
// same split, and same reasoning, the webhook already uses for referral rewards.

import { query } from './db';
import stripe from './stripe';
import {
  STANDARD_FEE_PERCENT,
  DISCOUNTED_FEE_PERCENT,
  FEE_DISCOUNT_THRESHOLD_CENTS,
  MIN_FEE_PERCENT,
} from './stripe';

const MILESTONE_POINTS_SQL = `
  SELECT COALESCE(SUM(reduction_points), 0)::int AS points
  FROM platform_milestones WHERE crossed_at IS NOT NULL`;

// Retired: platform-wide milestones no longer reduce anyone's fee. 7% (== the existing
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
// current milestone bonus, floored at MIN_FEE_PERCENT.
export function applyPlatformMilestoneReduction(basePercent, reductionPoints) {
  return Math.max(MIN_FEE_PERCENT, basePercent - reductionPoints);
}

// Runs inside the webhook's DB transaction (`client` is that transaction's connection).
// Records this invoice's payment in the ledger — idempotent on stripe_invoice_id, a
// belt-and-suspenders guard on top of the webhook's own per-event idempotency claim —
// stamped with the EFFECTIVE rate actually charged (personal tier minus whatever
// milestone bonus already existed before this invoice), so historical net-earnings math
// stays accurate no matter how either discount moves later. Then recomputes the personal
// tier off THIS CALENDAR MONTH's earnings so far (including the invoice just recorded) and
// checks the platform-wide milestone crossings this payment might have triggered. Returns
// null when nothing changed (duplicate delivery, not a creator, or neither discount moved),
// otherwise `{ personalTierChange, crossedMilestones }` — personalTierChange is the
// creator's new personal-tier percent when this month's total just crossed (or fell back
// below) the threshold (null otherwise), and crossedMilestones is the list of platform
// milestones (if any) newly crossed by this payment. The caller syncs whichever of those
// actually happened to Stripe once the transaction is safely committed.
export async function recordEarningAndCheckFeeTier(client, { creatorId, stripeInvoiceId, amountCents }) {
  if (!creatorId || !stripeInvoiceId || !(amountCents > 0)) return null;

  // Lock the creator's row before recording anything, so two of their invoices landing in
  // overlapping webhook deliveries can't both read the pre-crossing total and both think
  // they're the one that needs to flip their personal tier.
  const creatorResult = await client.query(
    `SELECT platform_fee_percent FROM users WHERE id = $1 FOR UPDATE`,
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

  // This calendar month's earnings so far (including the invoice just recorded above)
  // decide the personal tier for the rest of the month. Unlike a lifetime total this can
  // move in either direction — a creator who crossed $2,000 last month but hasn't yet this
  // month goes back to STANDARD_FEE_PERCENT the moment their next invoice lands, rather than
  // staying discounted forever off one good month long past.
  const monthTotalResult = await client.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
     FROM creator_earnings
     WHERE creator_id = $1 AND created_at >= date_trunc('month', now())`,
    [creatorId]
  );
  const monthToDateCents = Number(monthTotalResult.rows[0].total);
  const targetFeePercent =
    monthToDateCents >= FEE_DISCOUNT_THRESHOLD_CENTS ? DISCOUNTED_FEE_PERCENT : STANDARD_FEE_PERCENT;

  let personalTierChange = null;
  if (targetFeePercent !== currentFeePercent) {
    await client.query('UPDATE users SET platform_fee_percent = $1 WHERE id = $2', [
      targetFeePercent,
      creatorId,
    ]);
    personalTierChange = targetFeePercent;
  }

  const crossedMilestones = await checkPlatformMilestones(client);

  if (personalTierChange === null && crossedMilestones.length === 0) return null;
  return { personalTierChange, crossedMilestones };
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
      await stripe.subscriptions.update(stripe_subscription_id, { application_fee_percent: effectiveFeePercent });
    } catch (err) {
      console.error(`Failed to sync application_fee_percent for subscription ${stripe_subscription_id}:`, err);
    }
  }
}

// Best-effort, run AFTER a transaction that just crossed one or more PLATFORM milestones
// has committed: re-points every currently active (or past_due) Stripe subscription
// across EVERY creator at once, since a platform milestone lowers everyone's effective
// rate simultaneously -- not just the creator whose invoice happened to trigger it. Same
// "best-effort, no retry queue" tradeoff as the per-creator sync above, just platform-wide.
export async function syncAllActiveSubscriptionsToCurrentEffectiveFee() {
  const reductionPoints = await getPlatformMilestoneReductionPoints(query);

  const subsResult = await query(
    `SELECT s.stripe_subscription_id, u.platform_fee_percent
     FROM subscriptions s
     JOIN users u ON u.id = s.creator_id
     WHERE s.status IN ('active', 'past_due') AND s.stripe_subscription_id IS NOT NULL`
  );
  for (const { stripe_subscription_id, platform_fee_percent } of subsResult.rows) {
    const effectiveFeePercent = applyPlatformMilestoneReduction(platform_fee_percent, reductionPoints);
    try {
      await stripe.subscriptions.update(stripe_subscription_id, { application_fee_percent: effectiveFeePercent });
    } catch (err) {
      console.error(`Failed to sync platform milestone fee for subscription ${stripe_subscription_id}:`, err);
    }
  }
}
