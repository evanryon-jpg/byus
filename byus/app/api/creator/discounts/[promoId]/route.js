export const dynamic = 'force-dynamic';

// DELETE /api/creator/discounts/:promoId -> deactivate a discount code (soft-delete,
// same reasoning as deactivating a tier: a code that's already been used shouldn't
// vanish from Stripe's own records, it should just stop working for future checkouts).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';

export async function DELETE(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can deactivate discount codes.' }, { status: 403 });
  }

  const { promoId } = params;

  try {
    const promotionCode = await stripe.promotionCodes.retrieve(promoId);
    if (promotionCode.coupon?.metadata?.creator_id !== session.userId) {
      return NextResponse.json({ error: 'Code not found.' }, { status: 404 });
    }
    const updated = await stripe.promotionCodes.update(promoId, { active: false });
    return NextResponse.json({ code: { id: updated.id, active: updated.active } });
  } catch (err) {
    console.error('creator/discounts DELETE failed:', err);
    return NextResponse.json({ error: 'Could not deactivate this code. Try again.' }, { status: 500 });
  }
}
