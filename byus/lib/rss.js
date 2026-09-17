// Minimal RSS 2.0 / Atom feed parser for the blogger RSS-import feature (see
// app/api/creator/rss/route.js). Deliberately hand-rolled instead of pulling in a
// third-party XML library -- feed items are simple, mostly-flat XML, and a handful of
// tag-scoped regexes handles the tags every real-world blog feed actually uses,
// without adding a new dependency for it. This is not a general XML parser: anything
// outside <item>/<entry> and the handful of child tags below is ignored.

const MAX_ITEMS = 25; // never import more than this many entries in one sync
export const TITLE_MAX = 200;
export const BODY_MAX = 20000;

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Numeric character references -- &#39; (decimal) and &#x27; (hex) both show up
    // constantly in real feeds (WordPress in particular favors the hex form for
    // apostrophes), and the earlier decimal-only pattern here left &#x27; untouched,
    // so imported posts showed literal "Cloudflare&#x27;s" instead of "Cloudflare's".
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // &amp; last -- decoding it earlier would turn a literal "&amp;#39;" in the feed
    // into "&#39;" and get re-decoded by the numeric-entity rules above, corrupting
    // any post whose text actually contains that literal sequence.
    .replace(/&amp;/g, '&')
    .trim();
}

// Feed descriptions/content are almost always HTML -- posts on ByUs are plain text,
// same as a manually-written post, so tags are stripped rather than stored raw.
function stripHtml(str) {
  if (!str) return '';
  return decodeEntities(str)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(re);
  return match ? match[1] : null;
}

// Atom links are self-closed attributes (<link href="..." rel="alternate"/>) rather
// than a text node -- prefers rel="alternate" (the human-readable page) over other
// rel values like "self" (the feed URL) or "enclosure".
function extractAtomLink(block) {
  const linkTags = [...block.matchAll(/<link\b([^>]*?)\/?>(?:<\/link>)?/gi)];
  let fallback = null;
  for (const m of linkTags) {
    const attrs = m[1];
    const hrefMatch = attrs.match(/href="([^"]*)"/);
    if (!hrefMatch) continue;
    const relMatch = attrs.match(/rel="([^"]*)"/);
    if (!relMatch || relMatch[1] === 'alternate') return hrefMatch[1];
    if (!fallback) fallback = hrefMatch[1];
  }
  return fallback;
}

// Parses a raw RSS 2.0 or Atom feed body into normalized entries (newest-first, as
// the feed itself orders them): { guid, link, title, body, publishedAt }. Entries
// with no stable identity (no guid/id and no link) or no body text are skipped
// outright -- there's nothing safe to dedupe or post from either.
export function parseFeed(xml) {
  if (!xml || typeof xml !== 'string') return [];

  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const itemTag = isAtom ? 'entry' : 'item';
  const itemRe = new RegExp(`<${itemTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${itemTag}>`, 'gi');
  const blocks = [...xml.matchAll(itemRe)].map((m) => m[1]);

  const entries = [];
  for (const block of blocks.slice(0, MAX_ITEMS)) {
    const link = isAtom ? extractAtomLink(block) : decodeEntities(extractTag(block, 'link'));
    const rawGuid = extractTag(block, 'guid') || extractTag(block, 'id');
    const guid = (rawGuid ? decodeEntities(rawGuid) : null) || link;
    if (!guid) continue;

    const rawBody =
      extractTag(block, 'content:encoded') ||
      extractTag(block, 'content') ||
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      '';
    const body = stripHtml(rawBody);
    if (!body) continue;

    const title = decodeEntities(extractTag(block, 'title')) || 'Untitled post';
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    const publishedAt = pubDate && !isNaN(Date.parse(pubDate)) ? new Date(pubDate) : null;

    entries.push({
      guid: guid.slice(0, 500),
      link: link ? link.slice(0, 2000) : null,
      title: title.slice(0, TITLE_MAX),
      body: body.slice(0, BODY_MAX),
      publishedAt,
    });
  }
  return entries;
}
