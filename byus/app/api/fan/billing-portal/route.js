export const dynamic = 'force-dynamic';

// POST /api/fan/billing-portal
// Opens a Stripe Billing Portal session for the logged-in fan -- the fastest way for them
// to update a card, view invoices, or cancel a subscription without emailing support.
// Stripe's portal is scoped to a single Customer and shows every subscription that
// Customer has, which is why /api/subscribe reuses one Stripe Customer per fan across
// every creator they subscribe to instead of minting a new one per checkout.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request) {
    const session = await getCurrentUser();
    if (!session || session.role !== 'fan') {
          return NextResponse.json({ error: 'Only fans can manage billing here.' }, { status: 403 });
    }

  const rateCheck = await checkRateLimit('billing-portal', `user:${session.userId}`);
    if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
        const userResult = await query('SELECT stripe_customer_id FROM users WHERE id = $1', [session.userId]);
        const customerId = userResult.rows[0]?.stripe_customer_id;
        if (!customerId) {
                // Nothing to manage yet -- this fan has never completed a checkout, so Stripe has no
          // Customer record for them at all.
          return NextResponse.json(
            { error: 'You dont have a billing account yet -- subscribe to a creator first.' },
            { status: 400 }
                  );
        }

      const origin = request.headers.get('origin') || process.env.APP_URL;
        const portalSession = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: `${origin}/fan/dashboard`,
        });

      return NextResponse.json({ url: portalSession.url });
  } catch (err) {
        console.error('billing-portal failed:', err);
        return NextResponse.json(
          { error: 'Could not open billing. Try again in a moment.' },
          { status: 500 }
              );
  }
}
