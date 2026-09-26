// Evidence of where each paying fan lives, for UK and EU VAT (Sept 26, 2026).
//
// The rule (HMRC's guidance and the EU's): a seller of digital services to consumers keeps
// two pieces of non-contradictory evidence of where the customer lives. ByUs records three
// on every fan payment and takes the country at least two agree on:
//   1. billing country  -- the address Stripe Checkout collects (what Stripe Tax charges on)
//   2. card country     -- where the card was issued (Stripe records it on the charge)
//   3. IP country       -- from the fan's IP when they started checkout (Vercel's geo header),
//                          carried to the webhook in the Stripe metadata set below
// A French card on a US IP with a US billing address resolves to the US on its own. Only
// payments where no two agree, or where the two that agree differ from the country Stripe
// charged tax for, are flagged -- never blocked. They show on /admin/tax-evidence and in
// the daily digest, so the fan can be asked to confirm, which is what HMRC says to do.
// Table and retention rules: database/migrations/20260926c_tax_location_evidence.sql.
// Server-only.

import { query } from '@/lib/db';
import { paymentProvider } from '@/lib/payments';
import { getClientIp } from '@/lib/rate-limit';

const ISO2 = /^[A-Z]{2}$/;
const clean = (v) => (typeof v === 'string' && ISO2.test(v.toUpperCase()) ? v.toUpperCase() : null);

// Stripe metadata for a new Checkout Session: the fan's IP and its country. Stripe only
// keeps metadata for ByUs (fans never see it). Keys are left out when unknown.
export function locationEvidenceMetadata(request) {
  const out = {};
  const ip = getClientIp(request);
  if (ip && ip !== 'unknown') out.byus_ip = ip.slice(0, 64);
  const country = clean(request.headers.get('x-vercel-ip-country'));
  if (country) out.byus_ip_country = country;
  out.byus_ip_at = String(Math.floor(Date.now() / 1000));
  return out;
}

// { resolved, status, reason } from the three countries (any may be null).
export function resolveLocation({ billing, card, ip }) {
  const pieces = [
    ['billing address', clean(billing)],
    ['card', clean(card)],
    ['IP address', clean(ip)],
  ].filter(([, c]) => c);
  const counts = new Map();
  for (const [, c] of pieces) counts.set(c, (counts.get(c) || 0) + 1);
  let resolved = null;
  for (const [c, n] of counts) if (n >= 2) resolved = c;
  const taxed = clean(billing);

  if (pieces.length < 2) {
    return { resolved: null, status: 'conflict', reason: `Only ${pieces.length} piece of location evidence (${pieces.map(([k, c]) => `${k}: ${c}`).join(', ') || 'none'}).` };
  }
  if (!resolved) {
    return { resolved: null, status: 'conflict', reason: `No two pieces agree (${pieces.map(([k, c]) => `${k}: ${c}`).join(', ')}).` };
  }
  if (taxed && resolved !== taxed) {
    return { resolved, status: 'conflict', reason: `Card and IP point to ${resolved}, but tax was charged for the billing country ${taxed}.` };
  }
  return { resolved, status: 'ok', reason: null };
}

// Records one payment's evidence. Idempotent per charge (webhook retries are no-ops).
export async function recordLocationEvidence({
  chargeId, invoiceId = null, paymentKind, fanId, creatorId, taxCents = 0, metadata = {},
}) {
  if (!chargeId) return null;
  const charge = await paymentProvider.retrieveChargeLocation({ id: chargeId });
  const ipCountry = clean(metadata.byus_ip_country);
  const { resolved, status, reason } = resolveLocation({
    billing: charge.billingCountry, card: charge.cardCountry, ip: ipCountry,
  });
  const ipAt = Number(metadata.byus_ip_at);
  const result = await query(
    `INSERT INTO tax_location_evidence
       (stripe_charge_id, stripe_invoice_id, payment_kind, fan_id, creator_id, amount_cents, tax_cents,
        billing_country, card_country, ip_country, ip_address, ip_captured_at,
        resolved_country, taxed_country, status, conflict_reason, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             CASE WHEN $12::bigint > 0 THEN to_timestamp($12::bigint) END,
             $13, $14, $15, $16, to_timestamp($17))
     ON CONFLICT (stripe_charge_id) DO NOTHING
     RETURNING id, status`,
    [
      chargeId, invoiceId, paymentKind, fanId || null, creatorId || null, charge.amountCents, taxCents,
      clean(charge.billingCountry), clean(charge.cardCountry), ipCountry,
      typeof metadata.byus_ip === 'string' ? metadata.byus_ip.slice(0, 64) : null,
      Number.isFinite(ipAt) ? ipAt : 0,
      resolved, clean(charge.billingCountry), status, reason, charge.createdAt,
    ]
  );
  return result.rows[0] || null;
}

export async function countOpenLocationConflicts() {
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM tax_location_evidence WHERE status = 'conflict'`);
  return rows[0]?.n || 0;
}
