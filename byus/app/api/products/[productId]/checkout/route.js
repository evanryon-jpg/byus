export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { paymentProvider } from '@/lib/payments';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getPlatformMilestoneReductionPoints, applyPlatformMilestoneReduction } from '@/lib/fees';
import { scoreCheckout, riskMetadata } from '@/lib/risk-score';
import { MIN_DIGITAL_PRODUCT_PRICE_CENTS } from '@/lib/pricing';

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'Please log in to purchase.' }, { status: 401 });
  if (session.role !== 'fan') return NextResponse.json({ error: 'Only fan accounts can purchase.' }, { status: 403 });

  const rateCheck = await checkRateLimit('product-checkout', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  try {
    const result = await query(
      `SELECT p.id, p.title, p.price_cents, p.creator_id, p.access_type,
              u.display_name, u.stripe_connect_account_id, u.stripe_connect_onboarded,
              u.platform_fee_percent, u.review_cleared_at,
              f.email_verified, f.stripe_customer_id
       FROM digital_products p
       JOIN users u ON u.id = p.creator_id
       JOIN users f ON f.id = $2
       WHERE p.id = $1 AND p.active = true`,
      [params.productId, session.userId]
    );
    const product = result.rows[0];
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    if (product.access_type !== 'purchase') {
      return NextResponse.json({ error: 'This download is included with an active membership.' }, { status: 400 });
    }
    if (!Number.isInteger(product.price_cents) || product.price_cents < MIN_DIGITAL_PRODUCT_PRICE_CENTS) {
      return NextResponse.json(
        { error: 'This product is below ByUs’s $5 minimum for new purchases.' },
        { status: 400 }
      );
    }
    if (!product.email_verified) return NextResponse.json({ error: 'Verify your email before purchasing.' }, { status: 403 });
    if (!product.stripe_connect_onboarded || !product.review_cleared_at) {
      return NextResponse.json({ error: 'This product is not available for purchase yet.' }, { status: 400 });
    }
    if (product.creator_id === session.userId) {
      return NextResponse.json({ error: "You can't purchase your own product." }, { status: 400 });
    }

    const existing = await query(
      `SELECT 1 FROM digital_purchases
       WHERE product_id = $1 AND fan_id = $2 AND status = 'succeeded'`,
      [product.id, session.userId]
    );
    if (existing.rows.length) {
      // A product can now bundle several files, so there's no single "the" download
      // URL to hand back anymore -- tell the client it's already owned and let it
      // re-fetch the product list, where DigitalProductShop renders the file bundle.
      return NextResponse.json({ alreadyOwned: true });
    }

    let customerId = product.stripe_customer_id;
    if (!customerId) {
      const customer = await paymentProvider.createCustomer({ email: session.email, userId: session.userId });
      customerId = customer.customerId;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, session.userId]);
    }

    const reduction = await getPlatformMilestoneReductionPoints(query);
    const feePercent = applyPlatformMilestoneReduction(product.platform_fee_percent, reduction);
    const applicationFeeCents = Math.round((product.price_cents * feePercent) / 100);
    const origin = request.headers.get('origin') || process.env.APP_URL;

    // Advisory risk score (see lib/risk-score.js) -- recorded and stamped onto the
    // Stripe session's metadata; never blocks the purchase.
    const risk = await scoreCheckout({
      request,
      userId: session.userId,
      email: session.email,
      creatorId: product.creator_id,
      kind: 'product',
      amountCents: product.price_cents,
    });

    const { url } = await paymentProvider.createOneTimePaymentCheckoutSession({
      customerId,
      amountCents: product.price_cents,
      productName: product.title,
      applicationFeeCents,
      connectedAccountId: product.stripe_connect_account_id,
      successUrl: `${origin}/fan/dashboard?downloadPurchased=true`,
      cancelUrl: `${origin}/creator/${product.creator_id}`,
      checkoutDisclosure: 'One-time purchase of a digital download. Digital purchases are generally non-refundable after download except where required by law or when ByUs determines a refund is appropriate.',
      metadata: {
        type: 'digital_product',
        product_id: product.id,
        fan_id: session.userId,
        creator_id: product.creator_id,
        purchase_price_cents: String(product.price_cents),
        ...riskMetadata(risk),
      },
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('product checkout failed:', err);
    return NextResponse.json({ error: 'Could not start checkout. Try again.' }, { status: 500 });
  }
}
