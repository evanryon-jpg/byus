// Where ByUs can pay creators. Safe to import from client and server code.
//
// Creator payout accounts are US-only at launch (lib/payments/providers/stripe.js creates
// every Express account in the platform's country). Stripe can pay creators in the UK, the
// EEA, Canada and Switzerland from a US platform, so those are "soon": people there can
// reserve a founding spot now and get emailed when their country opens. Anywhere else
// isn't supported by Stripe's self-serve cross-border payouts, so those people join the
// list without taking a founding spot (see the founding_waitlist trigger in
// database/migrations/20260926_waitlist_country.sql).
//
// The founding-spot form stores the ISO code in founding_waitlist.country; 'OTHER' means
// a country not listed here. NULL (entries from before Sept 26, 2026) is treated as US.

export const LAUNCH_COUNTRIES = ['US'];

const SOON = [
  ['GB', 'United Kingdom'], ['CA', 'Canada'],
  ['AT', 'Austria'], ['BE', 'Belgium'], ['BG', 'Bulgaria'], ['HR', 'Croatia'], ['CY', 'Cyprus'],
  ['CZ', 'Czechia'], ['DK', 'Denmark'], ['EE', 'Estonia'], ['FI', 'Finland'], ['FR', 'France'],
  ['DE', 'Germany'], ['GR', 'Greece'], ['HU', 'Hungary'], ['IS', 'Iceland'], ['IE', 'Ireland'],
  ['IT', 'Italy'], ['LV', 'Latvia'], ['LI', 'Liechtenstein'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'],
  ['MT', 'Malta'], ['NL', 'Netherlands'], ['NO', 'Norway'], ['PL', 'Poland'], ['PT', 'Portugal'],
  ['RO', 'Romania'], ['SK', 'Slovakia'], ['SI', 'Slovenia'], ['ES', 'Spain'], ['SE', 'Sweden'],
  ['CH', 'Switzerland'],
];

// Order for the form's dropdown: US first, then the two biggest "soon" markets, then the
// rest alphabetically, then the catch-all.
export const CREATOR_COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  ...SOON.slice(0, 2).map(([code, name]) => ({ code, name })),
  ...SOON.slice(2).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => ({ code, name })),
  { code: 'OTHER', name: 'Somewhere else' },
];

const NAMES = Object.fromEntries(CREATOR_COUNTRY_OPTIONS.map((c) => [c.code, c.name]));
const SOON_CODES = new Set(SOON.map(([code]) => code));

export function isCreatorCountryCode(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(NAMES, code);
}

export function creatorCountryName(code) {
  if (!code) return 'United States';
  return NAMES[code] || code;
}

// 'launch' | 'soon' | 'unsupported'. Missing/NULL counts as launch (pre-country entries).
export function creatorCountryStatus(code) {
  if (!code || LAUNCH_COUNTRIES.includes(code)) return 'launch';
  if (SOON_CODES.has(code)) return 'soon';
  return 'unsupported';
}
