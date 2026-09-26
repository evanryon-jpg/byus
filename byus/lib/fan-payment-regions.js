// Counts fan payments by country for the daily digest (app/api/cron/ops-digest).
//
// Why: ByUs is the seller on every charge, so ByUs owes any VAT/GST on digital sales to
// fans abroad. Three groups matter (decided Sept 26, 2026; confirm with Yonda):
//   - UK and EU: owed from the first sale. ByUs is registering for both. Checkout already
//     runs Stripe Tax, which collects $0 until the registrations are added in Stripe.
//   - NO_THRESHOLD: other countries that tax foreign digital sellers from the first sale.
//     No plan yet to register in these; any payments from them should be seen early.
//   - THRESHOLDS: countries that only apply once yearly sales pass a threshold. Tracked
//     against this calendar year's sales. Norway's is the lowest by far.
// Lists come from a published table of e-services VAT rules (shared by Evan, Sept 26,
// 2026) and may be out of date; USD figures are rough conversions. Stripe Tax's own
// monitoring page (Stripe -> Tax -> Registrations) is the authoritative threshold tracker.
// Server-only.

import { paymentProvider } from '@/lib/payments';

const EU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

export const NO_THRESHOLD = {
  AL: 'Albania', BR: 'Brazil', BY: 'Belarus', CL: 'Chile', CO: 'Colombia', DZ: 'Algeria',
  ID: 'Indonesia', KR: 'South Korea', MD: 'Moldova', MX: 'Mexico', NG: 'Nigeria',
  PE: 'Peru', PY: 'Paraguay', RS: 'Serbia', RU: 'Russia', SA: 'Saudi Arabia',
  TN: 'Tunisia', TR: 'Turkey', UG: 'Uganda', UY: 'Uruguay', UZ: 'Uzbekistan', ZW: 'Zimbabwe',
};

// Yearly sales threshold per country, as a rough USD figure (local amount in the label).
export const THRESHOLDS = {
  NO: { name: 'Norway', usdCents: 470000, local: 'NOK 50,000' },
  IS: { name: 'Iceland', usdCents: 1450000, local: 'ISK 2 million' },
  CA: { name: 'Canada', usdCents: 2200000, local: 'C$30,000' },
  IN: { name: 'India', usdCents: 2400000, local: 'INR 2 million' },
  NZ: { name: 'New Zealand', usdCents: 3600000, local: 'NZ$60,000' },
  AU: { name: 'Australia', usdCents: 4900000, local: 'A$75,000' },
  ZA: { name: 'South Africa', usdCents: 5500000, local: 'ZAR 1 million' },
  JP: { name: 'Japan', usdCents: 6700000, local: '¥10 million' },
  SG: { name: 'Singapore', usdCents: 7500000, local: 'S$100,000' },
  CH: { name: 'Switzerland', usdCents: 12000000, local: 'CHF 100,000' },
};

function empty() {
  return { total: 0, uk: 0, eu: 0, ukCents: 0, euCents: 0 };
}

// Returns {
//   last24h, monthToDate: { total, uk, eu, ukCents, euCents },
//   noThresholdThisYear: [{ code, name, count, cents }],        (any payments at all)
//   thresholdsThisYear: [{ code, name, local, cents, usdCents, pct }], (any payments)
//   otherThisYear: [{ code, count, cents }],                     (every other non-US country)
//   truncated: bool   (the charge list hit its cap, so year totals are low)
// }
export async function countFanPaymentsByRegion() {
  const now = new Date();
  const yearStart = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
  const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  const dayAgo = Math.floor(now.getTime() / 1000) - 86400;
  const since = Math.min(yearStart, dayAgo);
  const max = 3000;
  const charges = await paymentProvider.listSucceededChargeCountries({ createdGte: since, max });

  const result = { last24h: empty(), monthToDate: empty() };
  const year = new Map(); // country -> { count, cents }
  for (const c of charges) {
    const buckets = [];
    if (c.createdAt >= dayAgo) buckets.push(result.last24h);
    if (c.createdAt >= monthStart) buckets.push(result.monthToDate);
    for (const b of buckets) {
      b.total += 1;
      if (c.country === 'GB') { b.uk += 1; b.ukCents += c.amountCents; }
      else if (EU.has(c.country)) { b.eu += 1; b.euCents += c.amountCents; }
    }
    if (c.createdAt >= yearStart && c.country && c.country !== 'US') {
      const y = year.get(c.country) || { count: 0, cents: 0 };
      y.count += 1; y.cents += c.amountCents;
      year.set(c.country, y);
    }
  }

  result.noThresholdThisYear = [];
  result.thresholdsThisYear = [];
  result.otherThisYear = [];
  for (const [code, y] of year) {
    if (code === 'GB' || EU.has(code)) continue;
    if (NO_THRESHOLD[code]) {
      result.noThresholdThisYear.push({ code, name: NO_THRESHOLD[code], ...y });
    } else if (THRESHOLDS[code]) {
      const t = THRESHOLDS[code];
      result.thresholdsThisYear.push({
        code, name: t.name, local: t.local, cents: y.cents, usdCents: t.usdCents,
        pct: Math.round((y.cents / t.usdCents) * 100),
      });
    } else {
      result.otherThisYear.push({ code, ...y });
    }
  }
  result.noThresholdThisYear.sort((a, b) => b.cents - a.cents);
  result.thresholdsThisYear.sort((a, b) => b.pct - a.pct);
  result.otherThisYear.sort((a, b) => b.cents - a.cents);
  result.truncated = charges.length >= max;
  return result;
}
