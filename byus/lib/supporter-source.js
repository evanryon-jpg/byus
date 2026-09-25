// Where a creator's supporters came from -- the evidence behind the creator dashboard's
// "brought by ByUs" numbers. Safe to import from both client and server code (no Node-only
// imports).
//
// How it works:
//   1. The first time a visitor lands on a creator's page, app/components/
//      SupporterSourceCapture.jsx works out how they got there and saves it in the
//      `byus_src` cookie, keyed by that creator. First visit wins and is never overwritten,
//      so credit goes to whatever actually introduced them.
//   2. When that visitor later follows, subscribes, tips or buys, the server reads the
//      cookie (supporterSourceFromRequest below) and stores the source on the row:
//      creator_follows.supporter_source, subscriptions.supporter_source (via Stripe
//      metadata) and transactions.supporter_source (tips and digital products).
//   3. The creator dashboard groups those rows with supporterSourceBucket.
//
// Rows from before Sept 25, 2026 have no source and show as "before tracking".

export const SUPPORTER_SOURCE_COOKIE = 'byus_src';
export const SUPPORTER_SOURCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days
const MAX_ENTRIES = 25;

// Found through ByUs itself.
export const BYUS_SOURCES = ['discover', 'browse', 'home', 'recommendation', 'byus_page'];
// Everything else we can tell apart.
export const OTHER_SOURCES = ['creator_link', 'search', 'ad'];
export const SUPPORTER_SOURCES = [...BYUS_SOURCES, ...OTHER_SOURCES];

export function isSupporterSource(value) {
  return typeof value === 'string' && SUPPORTER_SOURCES.includes(value);
}

// 'byus' | 'creator' | 'other' | 'untracked'
export function supporterSourceBucket(source) {
  if (!source) return 'untracked';
  if (BYUS_SOURCES.includes(source)) return 'byus';
  if (source === 'creator_link') return 'creator';
  return 'other';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cookie value: "creatorId:source:dayNumber|creatorId:source:dayNumber|..."
// (dayNumber = days since the Unix epoch, base 36). Anything malformed is skipped.
export function parseSupporterSourceCookie(raw) {
  const entries = new Map();
  if (typeof raw !== 'string' || !raw) return entries;
  let value = raw;
  try { value = decodeURIComponent(raw); } catch { /* keep raw */ }
  for (const part of value.split('|')) {
    const [creatorId, source, day] = part.split(':');
    if (UUID_RE.test(creatorId || '') && isSupporterSource(source)) {
      entries.set(creatorId.toLowerCase(), { source, day: day || '' });
    }
  }
  return entries;
}

export function serializeSupporterSourceCookie(entries) {
  // Keep the newest MAX_ENTRIES so the cookie stays small (~1.5 KB at most).
  const list = [...entries.entries()]
    .sort((a, b) => parseInt(b[1].day || '0', 36) - parseInt(a[1].day || '0', 36))
    .slice(0, MAX_ENTRIES);
  return list.map(([id, { source, day }]) => `${id}:${source}:${day}`).join('|');
}

export function todayDayNumber() {
  return Math.floor(Date.now() / 86400000).toString(36);
}

// Server side: the recorded source for this visitor and creator, or null if there isn't
// one (older visit, cookies blocked, or they never loaded the creator's page).
export function supporterSourceFromRequest(request, creatorId) {
  if (!request || !creatorId) return null;
  let raw = null;
  try {
    raw = request.cookies?.get?.(SUPPORTER_SOURCE_COOKIE)?.value ?? null;
  } catch { /* fall through to the header */ }
  if (raw == null) {
    const header = request.headers?.get?.('cookie') || '';
    const match = header.split(/;\s*/).find((c) => c.startsWith(`${SUPPORTER_SOURCE_COOKIE}=`));
    raw = match ? match.slice(SUPPORTER_SOURCE_COOKIE.length + 1) : null;
  }
  const entry = parseSupporterSourceCookie(raw).get(String(creatorId).toLowerCase());
  return entry ? entry.source : null;
}

// Spread into Stripe Checkout metadata: { supporter_source } when known, else nothing.
export function supporterSourceMetadata(request, creatorId) {
  const source = supporterSourceFromRequest(request, creatorId);
  return source ? { supporter_source: source } : {};
}
