export const dynamic = 'force-dynamic';

// POST /api/admin/payments/disputes/:disputeId/recover
// Recovers the creator's transferred share after a destination-charge dispute is LOST.
//
// Safety rules:
// - Admin-only.
// - The dispute must already exist in ByUs and have terminal status 'lost'.
// - We wait until loss before reversing, which avoids the cross-border repayment problem
//   Stripe documents for reversing a transfer before a dispute outcome is known.
// - We only automate FULL-charge disputes here. Partial disputes need a proportional
//   reversal amount based on the original destination transfer, so they stay manual until
//   that amount can be verified precisely rather than guessed.
// - A synthetic record in processed_stripe_events acts as an application-level idempotency
//   guard so an admin double-click cannot intentionally run the same recovery twice.
// - The Stripe reversal itself also uses a deterministic idempotency key. If Stripe succeeds
//   but the DB transaction later rolls back, a retry returns the same reversal instead of
//   creating a second one.

import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { paymentProvider } from '@/lib/payments';

export async function POST(_request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const disputeId = typeof params?.disputeId === 'string' ? params.disputeId.trim() : '';
  if (!disputeId.startsWith('du_')) {
    return NextResponse.json({ error: 'A valid Stripe dispute ID is required.' }, { status: 400 });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Serialize concurrent attempts for this dispute. This lock exists only for the
      // duration of the transaction and prevents two admin requests racing each other.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `byus_dispute_recovery:${disputeId}`,
      ]);

      const disputeResult = await client.query(
        `SELECT stripe_dispute_id, stripe_charge_id, amount_cents, currency, status,
                creator_id, fan_id
         FROM stripe_disputes
         WHERE stripe_dispute_id = $1
         LIMIT 1`,
        [disputeId]
      );
      const dispute = disputeResult.rows[0];

      if (!dispute) {
        return { httpStatus: 404, body: { error: 'Dispute not found.' } };
      }

      if (dispute.status !== 'lost') {
        return {
          httpStatus: 409,
          body: {
            error: 'Creator funds are only recovered automatically after a dispute is lost.',
            disputeStatus: dispute.status,
          },
        };
      }

      const recoveryEventId = `dispute_recovery:${disputeId}`;
      const previous = await client.query(
        `SELECT event_id FROM processed_stripe_events WHERE event_id = $1 LIMIT 1`,
        [recoveryEventId]
      );
      if (previous.rows[0]) {
        return {
          httpStatus: 200,
          body: { recovered: true, alreadyProcessed: true, disputeId },
        };
      }

      const charge = await paymentProvider.retrieveCharge({ id: dispute.stripe_charge_id });
      const chargeAmount = Number(charge.amount);
      const disputeAmount = Number(dispute.amount_cents);

      if (!Number.isInteger(chargeAmount) || chargeAmount <= 0) {
        throw new Error(`Stripe charge ${dispute.stripe_charge_id} has an invalid amount.`);
      }

      // Do not guess a proportional transfer reversal. Stripe supports partial reversals,
      // but the exact creator share must come from the transfer itself. Until that is wired
      // into the adapter, leave partial disputes for manual review in Stripe.
      if (disputeAmount !== chargeAmount) {
        return {
          httpStatus: 409,
          body: {
            error: 'Partial disputes require manual recovery review.',
            manualReviewRequired: true,
            disputeAmountCents: disputeAmount,
            chargeAmountCents: chargeAmount,
          },
        };
      }

      const transferId =
        typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.id || null;
      if (!transferId) {
        return {
          httpStatus: 409,
          body: {
            error: 'This charge has no destination transfer to recover.',
            manualReviewRequired: true,
          },
        };
      }

      // Full dispute => reverse the full creator destination transfer. The platform's own
      // application fee is NOT refunded here; this is a dispute loss, not a voluntary refund.
      const reversal = await paymentProvider.reverseDestinationChargeTransfer({
        chargeId: dispute.stripe_charge_id,
        idempotencyKey: `byus-dispute-recovery-${disputeId}`,
        metadata: {
          byus_dispute_recovery: 'true',
          byus_dispute_id: disputeId,
          byus_admin_user_id: session.userId,
        },
      });

      await client.query(
        `INSERT INTO processed_stripe_events (event_id, event_type)
         VALUES ($1, 'byus.dispute.creator_funds_recovered')`,
        [recoveryEventId]
      );

      return {
        httpStatus: 200,
        body: {
          recovered: true,
          alreadyProcessed: false,
          disputeId,
          chargeId: dispute.stripe_charge_id,
          creatorId: dispute.creator_id,
          fanId: dispute.fan_id,
          reversal,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err) {
    console.error('admin dispute recovery failed:', err);
    return NextResponse.json(
      {
        error: 'Could not recover creator funds. Review the dispute and transfer in Stripe before retrying.',
      },
      { status: 500 }
    );
  }
}
