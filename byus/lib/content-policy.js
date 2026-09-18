// Shared content blocklist, applied everywhere ByUs stores text a creator writes:
// bio, tier name/description, links, and post title/body. This is the technical
// backbone behind Section 5 of the Terms of Service (app/terms/page.js) -- Stripe's
// compliance review specifically asked for evidence that ByUs blocks this
// structurally, at write time, rather than only after a fan reports it.
//
// Two independent checks:
//   - containsBlockedContent(): a hard reject against the ADULT_DOMAINS /
//     EXPLICIT_KEYWORDS / ILLEGAL_KEYWORDS / HATE_VIOLENCE_KEYWORDS lists below.
//     Saving fails outright; nothing gets stored.
//   - containsUrl(): not a reject by itself -- a bio mentioning "find me on
//     instagram" is fine, and legitimate links belong in the dedicated Links
//     section, not banned from bio text. This just flags a bio worth a human
//     actually reading; see the "needs review" flag on the admin page.
//
// Deliberately simple substring matching over curated lists rather than a general
// classifier: cheap, nothing probabilistic to explain to a payment processor, and
// every match is something already agreed to violate the content guidelines. The
// tradeoff is it only catches what's on the list -- a floor, not a ceiling. Extend
// these as new cases come up.
//
// HATE_VIOLENCE_KEYWORDS is deliberately narrow: named, publicly designated
// terrorist/extremist organizations and unambiguous incitement phrases, not a
// general slur list. Slurs are heavily context-dependent -- reclaimed use,
// quotation, a report describing what someone else posted -- and a plain substring
// match can't tell those apart, so that broader class of violation is left to the
// report queue and human review (see app/api/reports/route.js) rather than an
// automated hard reject that would misfire constantly.

// Grouped by category purely for maintainability -- containsBlockedContent() below
// flattens and checks them as one list, so the grouping has no runtime effect.
const ADULT_DOMAINS = [
  // Subscription / creator platforms -- direct competitors fans could be steered to
  // instead of paying through ByUs.
  'onlyfans.com',
  'fansly.com',
  'manyvids.com',
  'clips4sale.com',
  'fancentro.com',
  'justfor.fans',
  'loyalfans.com',
  'unlockedcelebs.com',
  'admireme.vip',
  'fanvue.com',
  'iwantclips.com',
  'fantia.jp',

  // Live cam sites.
  'chaturbate.com',
  'stripchat.com',
  'myfreecams.com',
  'camsoda.com',
  'bongacams.com',
  'livejasmin.com',
  'cam4.com',
  'imlive.com',
  'streamate.com',
  'flirt4free.com',
  'jerkmate.com',
  'camwhores.tv',

  // High-traffic tube / streaming sites.
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'tube8.com',
  'spankbang.com',
  'motherless.com',
  'txxx.com',
  'eporner.com',
  'porntrex.com',
  'hclips.com',
  'drtuber.com',
  'tnaflix.com',
  'keezmovies.com',
  'porn.com',
  'beeg.com',
  '4tube.com',
  'sunporno.com',
  'porndig.com',
  'vporn.com',
  'hqporner.com',
  'pornone.com',
  'gotporn.com',
  'upornia.com',
  'xozilla.com',
  'porn300.com',

  // Studio / paysite networks.
  'brazzers.com',
  'realitykings.com',
  'bangbros.com',
  'naughtyamerica.com',
  'digitalplayground.com',
  'evilangel.com',
  'teamskeet.com',
  'vixen.com',
  'blacked.com',
  'tushy.com',
  'deeper.com',
  'mofos.com',
  'babes.com',
  'twistys.com',
  'adulttime.com',

  // Leak / piracy aggregators that specifically redistribute paid creator-platform
  // content (OnlyFans/Fansly-style) without payment -- the closest thing to a direct
  // threat to ByUs creators' own paywalled content.
  'coomer.party',
  'coomer.su',
  'thothub.tv',
  'thotsbay.com',
  'fapello.com',
  'simpcity.su',
  'leakedzone.com',
  'nudostar.com',

  // Hentai / adult anime & manga.
  'rule34.xxx',
  'nhentai.net',
  'e-hentai.org',
  'hentaihaven.xxx',
  'luscious.net',
  'hanime.tv',

  // General adult media / image hosts.
  'redgifs.com',
  'erome.com',
  'imagefap.com',
];

const EXPLICIT_KEYWORDS = [
  'onlyfans',
  'nsfw',
  'xxx',
  'pornographic',
  'porn',
  'nude photo',
  'nude pic',
  'nudes',
  'sex tape',
  'sexual content',
  'adult content',
  'explicit content',
  'fetish content',
  'escort service',
  'cam girl',
  'camgirl',
  'sugar daddy',
  'sugar baby',
  '18+',
];

// Illegal / infringing content -- high-confidence terms for piracy and stolen-credential
// activity. Like EXPLICIT_KEYWORDS above, a curated floor, not a ceiling; ambiguous IP
// disputes (e.g. a specific fan claim that a specific post infringes their work) still go
// through the report queue and manual review, not an automated substring match.
const ILLEGAL_KEYWORDS = [
  'leaked album',
  'leaked movie',
  'unreleased leak',
  'leaked onlyfans',
  'onlyfans leak',
  'leaked content',
  'leak site',
  'pirated',
  'bootleg copy',
  'cracked software',
  'cracked account',
  'stolen credit card',
  'stolen card number',
  'carding',
  'counterfeit goods',
  'replica designer',
];

// Violent extremism / hate speech -- see the file header comment above for why this list is
// limited to designated organizations and explicit incitement phrases rather than slurs.
const HATE_VIOLENCE_KEYWORDS = [
  'kill all',
  'exterminate them',
  'ethnic cleansing',
  'gas the',
  'race war',
  'white genocide',
  'isis',
  'al-qaeda',
  'al qaeda',
  'aryan brotherhood',
  'atomwaffen',
  'boogaloo',
];

function normalize(text) {
  return (text || '').toLowerCase();
}

// Checks `text` (and optionally more strings, e.g. a link's label alongside its
// URL) against the domain and keyword lists above. Returns { blocked: false } or
// { blocked: true, message } where `message` is a ready-to-display fragment like
// "links to onlyfans.com, which isn't allowed on ByUs" -- callers prefix it with
// whatever field they're validating, e.g. `Your bio ${check.message}.`
export function containsBlockedContent(...texts) {
  const normalized = normalize(texts.filter(Boolean).join(' '));
  if (!normalized) return { blocked: false };

  const domainHit = ADULT_DOMAINS.find((domain) => normalized.includes(domain));
  if (domainHit) {
    return { blocked: true, message: `links to ${domainHit}, which isn't allowed on ByUs` };
  }

  const keywordHit = EXPLICIT_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (keywordHit) {
    return { blocked: true, message: `mentions "${keywordHit}", which isn't allowed on ByUs` };
  }

  const illegalHit = ILLEGAL_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (illegalHit) {
    return { blocked: true, message: `mentions "${illegalHit}", which isn't allowed on ByUs` };
  }

  const hateViolenceHit = HATE_VIOLENCE_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (hateViolenceHit) {
    return { blocked: true, message: `mentions "${hateViolenceHit}", which isn't allowed on ByUs` };
  }

  return { blocked: false };
}

// True if `text` contains anything that looks like a URL. Not a reject -- see the
// file comment above -- just a signal for a human to look closer.
export function containsUrl(text) {
  return /https?:\/\/|www\./i.test(text || '');
}
