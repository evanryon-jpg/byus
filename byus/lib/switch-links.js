// Switching links (Sept 26, 2026): how a creator brings existing fans over from another
// platform without anyone paying twice. The creator makes a link in their dashboard with
// the date their fans' paid period elsewhere runs out (Patreon usually bills on the 1st).
// A fan who joins through it gets access immediately and their first ByUs charge lands on
// that date; Stripe Checkout's trial_end does the delaying. Until then no money moves, so
// ByUs pays nothing to Stripe for these fans (card, Billing and payout fees all need a
// real payment, and the $2 account fee only applies in months the creator gets paid).
//
// Limits, so a link can't become a standing free pass: the first charge date is 3 days to
// 12 months out; a link stops working 3 days before that date (Stripe needs the trial to
// end at least 48 hours after checkout); each link has a use cap; a fan can use one
// switching link per creator, once; a creator can have 5 active links at a time.
// Tables: database/migrations/20260926e_switch_links.sql. Server-only.

import crypto from 'crypto';
import { query } from '@/lib/db';

export const SWITCH_MIN_LEAD_DAYS = 3;
export const SWITCH_MAX_DAYS = 366;
export const SWITCH_MAX_ACTIVE_LINKS = 5;
export const SWITCH_MAX_USES = 5000;
const LEAD_MS = SWITCH_MIN_LEAD_DAYS * 86400 * 1000;

export function newSwitchCode() {
  // 10 chars from an unambiguous alphabet: hard to guess, easy to read aloud.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const CODE_RE = /^[A-Z2-9]{10}$/;

// The public view of a link for the creator page banner, or null if it can't be used.
export async function loadSwitchOffer({ code, creatorId }) {
  if (typeof code !== 'string' || !CODE_RE.test(code)) return null;
  const { rows } = await query(
    `SELECT id, label, first_charge_at, uses, max_uses, active, creator_id
     FROM switch_links WHERE code = $1`,
    [code]
  );
  const link = rows[0];
  if (!link || !link.active || link.creator_id !== creatorId) return null;
  if (link.uses >= link.max_uses) return null;
  if (new Date(link.first_charge_at).getTime() - Date.now() < LEAD_MS) return null;
  return { code, label: link.label, firstChargeAt: new Date(link.first_charge_at).toISOString() };
}

// For /api/subscribe: { link } when this fan can use this code on this creator right now,
// otherwise { error } with a message for the fan.
export async function checkSwitchLinkForCheckout({ code, creatorId, fanId }) {
  if (typeof code !== 'string' || !CODE_RE.test(code)) {
    return { error: 'This switching link isn’t valid. Ask the creator for a new one.' };
  }
  const { rows } = await query(
    `SELECT id, creator_id, first_charge_at, uses, max_uses, active FROM switch_links WHERE code = $1`,
    [code]
  );
  const link = rows[0];
  if (!link || link.creator_id !== creatorId || !link.active) {
    return { error: 'This switching link isn’t active anymore. You can still join at the regular price.' };
  }
  if (link.uses >= link.max_uses) {
    return { error: 'This switching link has been fully used. You can still join at the regular price.' };
  }
  const chargeMs = new Date(link.first_charge_at).getTime();
  if (chargeMs - Date.now() < LEAD_MS) {
    return { error: 'This switching link has expired. You can still join at the regular price.' };
  }
  const used = await query(
    `SELECT 1 FROM switch_link_redemptions WHERE creator_id = $1 AND fan_id = $2`,
    [creatorId, fanId]
  );
  if (used.rows.length > 0) {
    return { error: 'You’ve already used a switching link for this creator.' };
  }
  return { link: { id: link.id, firstChargeUnix: Math.floor(chargeMs / 1000), firstChargeAt: new Date(chargeMs) } };
}

// Called inside the Stripe webhook's transaction once the checkout completes.
export async function recordSwitchRedemption(client, { linkId, creatorId, fanId, subscriptionId }) {
  const inserted = await client.query(
    `INSERT INTO switch_link_redemptions (link_id, creator_id, fan_id, stripe_subscription_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (creator_id, fan_id) DO NOTHING
     RETURNING id`,
    [linkId, creatorId, fanId, subscriptionId]
  );
  if (inserted.rows.length > 0) {
    await client.query(`UPDATE switch_links SET uses = uses + 1 WHERE id = $1`, [linkId]);
  }
}
