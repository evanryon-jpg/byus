export const dynamic = 'force-dynamic';

// POST /api/admin/payments/refund
// Issues a voluntary refund for a ByUs destination charge. The payment adapter always
// reverses the creator transfer so the platform does not fund the customer's refund while
// leaving the creator's proceeds untouched. By default the application fee is refunded too,
// fully unwinding the transaction. This route deliberately handles refunds only — dispute
// transfer recovery has different cross-border rules and is managed separately.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { paymentProvider } from '@/lib/payments';

const ALLOWED_REASONS = new Set(['duplicate', 'fraudulent', 'requested_by_customer']);

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const chargeId = typeof payload?.chargeId === 'string' ? payload.chargeId.trim() : '';
  const amountCents = payload?.amountCents;
  const reason = ALLOWED_REASONS.has(payload?.reason)
    ? payload.reason
    : 'requested_by_customer';

  if (!chargeId.startsWith('ch_')) {
    return NextResponse.json({ error: 'A valid Stripe charge ID is required.' }, { status: 400 });
  }
  if (amountCents !== undefined && (!Number.isInteger(amountCents) || amountCents <= 0)) {
    return NextResponse.json({ error: 'amountCents must be a positive integer.' }, { status: 400 });
  }

  try {
    // Never let this endpoint become a generic "refund any Stripe charge" primitive. A
    // charge must first prove it belongs to ByUs through either a recorded one-time tip or
    // a subscription invoice that resolves to one of our local subscription rows.
    let localPayment = null;

    const tipResult = await query(
      `SELECT id, fan_id, creator_id, gross_amount_cents
       FROM transactions
       WHERE stripe_charge_id = $1
       LIMIT 1`,
      [chargeId]
    );

    if (tipResult.rows[0]) {
      localPayment = { type: 'tip', ...tipResult.rows[0] };
    } else {
      const charge = await paymentProvider.retrieveCharge({ id: chargeId });
      if (charge.invoice) {
        const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice.id;
        const invoice = await paymentProvider.retrieveInvoice({ id: invoiceId });
        const stripeSubscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || null;

        if (stripeSubscriptionId) {
          const subResult = await query(
            `SELECT id, fan_id, creator_id
             FROM subscriptions
             WHERE stripe_subscription_id = $1
             LIMIT 1`,
            [stripeSubscriptionId]
          );
          if (subResult.rows[0]) {
            localPayment = { type: 'subscription', ...subResult.rows[0] };
          }
        }
      }
    }

    if (!localPayment) {
      return NextResponse.json(
        { error: 'This charge could not be verified as a ByUs payment.' },
        { status: 404 }
      );
    }

    const refund = await paymentProvider.createDestinationChargeRefund({
      chargeId,
      amountCents,
      reason,
      refundApplicationFee: true,
      metadata: {
        byus_admin_refund: 'true',
        byus_admin_user_id: session.userId,
        byus_payment_type: localPayment.type,
      },
    });

    return NextResponse.json({
      refund: {
        ...refund,
        paymentType: localPayment.type,
        creatorId: localPayment.creator_id,
        fanId: localPayment.fan_id,
      },
    });
  } catch (err) {
    console.error('admin/payments/refund failed:', err);
    return NextResponse.json(
      { error: 'Could not issue the refund. Review the payment in Stripe and try again.' },
      { status: 500 }
    );
  }
}
