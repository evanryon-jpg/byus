export const dynamic = 'force-dynamic';

// GET /api/admin/payments/disputes/:disputeId/evidence
// Builds a concise, factual evidence package for a Stripe dispute from ByUs's own records.
// This does not submit anything to Stripe yet; it gives the admin one trustworthy place to
// review what ByUs can prove before deciding how to respond.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { disputeId } = params;

  try {
    const disputeResult = await query(
      `SELECT
         d.id,
         d.stripe_dispute_id,
         d.stripe_charge_id,
         d.amount_cents,
         d.currency,
         d.reason,
         d.status,
         d.opened_at,
         d.closed_at,
         d.subscription_id,
         d.creator_id,
         d.fan_id,
         creator.display_name AS creator_name,
         creator.email AS creator_email,
         fan.display_name AS fan_name,
         fan.email AS fan_email
       FROM stripe_disputes d
       LEFT JOIN users creator ON creator.id = d.creator_id
       LEFT JOIN users fan ON fan.id = d.fan_id
       WHERE d.id::text = $1 OR d.stripe_dispute_id = $1
       LIMIT 1`,
      [disputeId]
    );

    const dispute = disputeResult.rows[0];
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
    }

    let subscription = null;
    if (dispute.subscription_id) {
      const subResult = await query(
        `SELECT
           s.id,
           s.stripe_subscription_id,
           s.status,
           s.created_at,
           s.current_period_end,
           t.id AS tier_id,
           t.name AS tier_name,
           t.price_cents,
           t.annual_price_cents,
           t.trial_days
         FROM subscriptions s
         LEFT JOIN subscription_tiers t ON t.id = s.tier_id
         WHERE s.id = $1
         LIMIT 1`,
        [dispute.subscription_id]
      );
      subscription = subResult.rows[0] || null;
    }

    const evidenceResult = await query(
      `SELECT
         id,
         event_type,
         subscription_id,
         post_id,
         stripe_charge_id,
         metadata,
         occurred_at
       FROM payment_evidence_events
       WHERE ($1::uuid IS NOT NULL AND fan_id = $1)
         AND ($2::uuid IS NULL OR creator_id IS NULL OR creator_id = $2)
         AND occurred_at >= ($3::timestamptz - interval '90 days')
       ORDER BY occurred_at ASC
       LIMIT 500`,
      [dispute.fan_id, dispute.creator_id, dispute.opened_at]
    );

    return NextResponse.json({
      dispute: {
        id: dispute.id,
        stripeDisputeId: dispute.stripe_dispute_id,
        stripeChargeId: dispute.stripe_charge_id,
        amountCents: dispute.amount_cents,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        openedAt: dispute.opened_at,
        closedAt: dispute.closed_at,
      },
      fan: dispute.fan_id
        ? {
            id: dispute.fan_id,
            displayName: dispute.fan_name,
            email: dispute.fan_email,
          }
        : null,
      creator: dispute.creator_id
        ? {
            id: dispute.creator_id,
            displayName: dispute.creator_name,
            email: dispute.creator_email,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            stripeSubscriptionId: subscription.stripe_subscription_id,
            status: subscription.status,
            startedAt: subscription.created_at,
            currentPeriodEnd: subscription.current_period_end,
            tierId: subscription.tier_id,
            tierName: subscription.tier_name,
            monthlyPriceCents: subscription.price_cents,
            annualPriceCents: subscription.annual_price_cents,
            trialDays: subscription.trial_days,
          }
        : null,
      activityEvidence: evidenceResult.rows.map((row) => ({
        id: row.id,
        type: row.event_type,
        subscriptionId: row.subscription_id,
        postId: row.post_id,
        stripeChargeId: row.stripe_charge_id,
        metadata: row.metadata,
        occurredAt: row.occurred_at,
      })),
    });
  } catch (err) {
    console.error('admin dispute evidence GET failed:', err);
    return NextResponse.json(
      { error: 'Could not build the dispute evidence package.' },
      { status: 500 }
    );
  }
}
