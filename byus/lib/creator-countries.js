// Where ByUs can pay creators. Safe to import from client and server code.
//
// Creator payout accounts are US-only at launch (lib/payments/providers/stripe.js creates
// every Express account in the platform's country). Stripe can pay creators in the UK, the
// EEA, Canada and Switzerland from a US platform, so those are "soon": people there can
// join the list now and get emailed when their country opens. Anywhere else isn't
// supported by Stripe's self-serve cross-border payouts.
//
// Founding spots (10% for good) are for US creators only -- cross-border payouts cost ByUs
// about 1.25% more, which a 10% fee can't cover for smaller creators. Everyone outside the
// US joins at standard pricing (13%, 10% for any month they earn $2,000) and never takes
// one of the 50 spots (see the founding_waitlist trigger in
// database/migrations/20260926b_founding_spots_us_only.sql).
//
// The founding-spot form stores the ISO code in founding_waitlist.country; 'OTHER' means
// a country not listed here. NULL (entries from before Sept 26, 2026) is treated as US.

export const LAUNCH_COUNTRIES = ['US'];

// A second group of founding spots for creators in the UK, Europe and Canada, opening
// when creator accounts launch there (decided Sept 26, 2026). 11% rather than 10% because
// cross-border payouts cost ByUs ~1.25% more; at 11% an international founding creator
// leaves ByUs about the same margin as a US founding creator at 10%. First in line = the
// order people joined founding_waitlist (created_at). Not enforced in billing yet -- that
// ships with the international launch, before any non-US creator can be paid.
export const INTERNATIONAL_FOUNDING_LIMIT = 50;
export const INTERNATIONAL_FOUNDING_FEE_PERCENT = 11;

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
