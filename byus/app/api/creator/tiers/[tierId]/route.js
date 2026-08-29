export const dynamic = 'force-dynamic';

// PATCH  /api/creator/tiers/:tierId  -> update a tier's name/description, or toggle active
// DELETE /api/creator/tiers/:tierId  -> deactivate a tier (soft-delete)
//
// Price is intentionally not editable here — Stripe Prices are immutable once created, and
// silently changing what an existing subscriber pays isn't something we'd ever want to do.
// To change a price, deactivate this tier and create a new one at the new price.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';

async function loadOwnedTier(tierId, userId) {
  const result = await query(
    `SELECT id, creator_id, stripe_product_id FROM subscription_tiers WHERE id = $1`,
    [tierId]
  );
  const tier = result.rows[0];
  if (!tier || tier.creator_id !== userId) return null;
  return tier;
}

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can edit tiers.' }, { status: 403 });
  }

  const { tierId } = params;
  const { name, description, active } = await request.json();

  try {
    const tier = await loadOwnedTier(tierId, session.userId);
    if (!tier) {
      return NextResponse.json({ error: 'Tier not found.' }, { status: 404 });
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (typeof name === 'string' && name.trim()) {
      fields.push(`name = $${i++}`);
      values.push(name.trim());
    }
    if (typeof description === 'string') {
      fields.push(`description = $${i++}`);
      values.push(description || null);
    }
    if (typeof active === 'boolean') {
      fields.push(`active = $${i++}`);
      values.push(active);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    values.push(tierId);
    const result = await query(
      `UPDATE subscription_tiers SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, name, description, price_cents, active, created_at`,
      values
    );

    // Keep the Stripe Product name in sync so the creator's dashboard, receipts, and
    // Stripe's own UI don't show a stale name after a rename. Non-fatal — a Stripe hiccup
    // here shouldn't block the rename the creator actually asked for.
    if (typeof name === 'string' && name.trim() && tier.stripe_product_id) {
      try {
        await stripe.products.update(tier.stripe_product_id, { name: name.trim() });
      } catch (err) {
        console.error('Stripe product name sync failed (non-fatal):', err);
      }
    }

    return NextResponse.json({ tier: result.rows[0] });
  } catch (err) {
    console.error('creator/tiers PATCH failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not update this tier. Try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can delete tiers.' }, { status: 403 });
  }

  const { tierId } = params;

  try {
    const tier = await loadOwnedTier(tierId, session.userId);
    if (!tier) {
      return NextResponse.json({ error: 'Tier not found.' }, { status: 404 });
    }

    // Soft-delete only: hard-deleting would orphan any fan currently subscribed at this
    // tier. Deactivating hides it from the creator's public profile and blocks new
    // subscriptions, while existing subscribers keep exactly what they already have.
    const result = await query(
      `UPDATE subscription_tiers SET active = false WHERE id = $1
       RETURNING id, name, description, price_cents, active, created_at`,
      [tierId]
    );

    return NextResponse.json({ tier: result.rows[0] });
  } catch (err) {
    console.error('creator/tiers DELETE failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not delete this tier. Try again.' },
      { status: 500 }
    );
  }
}
