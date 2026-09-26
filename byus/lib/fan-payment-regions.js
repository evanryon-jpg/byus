// Counts fan payments from the UK and the EU for the daily digest (app/api/cron/ops-digest).
//
// Why: ByUs is the seller on every charge, and a US business selling digital services to
// UK or EU consumers owes VAT there from the first sale -- there's no minimum. Checkout
// already runs Stripe Tax (lib/payments/providers/stripe.js), but it collects $0 until ByUs
// adds UK/EU registrations in Stripe (Tax > Registrations). This makes the moment UK/EU
// fans start paying visible, so the registration step isn't missed. Server-only.

import { paymentProvider } from '@/lib/payments';

const EU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

function empty() {
  return { total: 0, uk: 0, eu: 0, ukCents: 0, euCents: 0 };
}

// { last24h: {...}, monthToDate: {...} } -- each { total, uk, eu, ukCents, euCents }.
export async function countFanPaymentsByRegion() {
  const now = new Date();
  const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  const dayAgo = Math.floor(now.getTime() / 1000) - 86400;
  const since = Math.min(monthStart, dayAgo);
  const charges = await paymentProvider.listSucceededChargeCountries({ createdGte: since });

  const result = { last24h: empty(), monthToDate: empty() };
  for (const c of charges) {
    const buckets = [];
    if (c.createdAt >= dayAgo) buckets.push(result.last24h);
    if (c.createdAt >= monthStart) buckets.push(result.monthToDate);
    for (const b of buckets) {
      b.total += 1;
      if (c.country === 'GB') { b.uk += 1; b.ukCents += c.amountCents; }
      else if (EU.has(c.country)) { b.eu += 1; b.euCents += c.amountCents; }
    }
  }
  return result;
}
