// Safely fetches a creator-supplied blog RSS/Atom feed URL for import (see
// app/api/creator/rss/route.js and lib/rss.js, which only ever parses the XML this
// returns). Split out from the route because "fetch a URL someone else gave you,
// from our own server" is exactly the shape of a server-side request forgery (SSRF)
// risk, and that risk deserves to live in one well-documented place rather than be
// re-derived inline in a route handler:
//
// A creator's feed URL is attacker-controlled input, even though the "attacker" is
// just a creator using a text field as intended. Whatever URL they enter, THIS
// SERVER makes the request, from inside our own network. Without the checks below, a
// creator (or anyone who can trick a creator's browser into submitting this form)
// could point the feed URL at http://169.254.169.254/... (the cloud metadata
// endpoint most providers expose to their own compute, sometimes reachable in ways
// that leak credentials), at localhost/127.0.0.1 to probe whatever else is listening
// on this function's own loopback interface, or at an internal-only hostname to map
// out what's reachable from Vercel's network. The response then gets parsed and
// possibly imported as posts, or at minimum its status/timing tells the caller
// something about what's on the other end -- either way, that's this server acting
// as an open proxy into places it shouldn't reach on someone else's behalf.

import dns from 'dns/promises';
import net from 'net';

const FETCH_TIMEOUT_MS = 10000;
// Real blog feeds are almost always well under a megabyte of XML. 5MB is generous
// headroom for a large feed while still bounding memory use -- without a cap here,
// a malicious or just misbehaving URL returning gigabytes of data would be read
// entirely into memory by a plain `res.text()`, which is an easy way to OOM-kill the
// function on nothing more than one sync click.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
// fetch() follows redirects by default, which quietly defeats a same-request host
// check: a URL that looks public at validation time can 302 to an internal address
// and the check never sees it. Redirects are instead followed manually, one hop at a
// time, re-validating the target host on every single hop -- capped low because a
// legitimate feed URL essentially never needs more than one or two redirects (e.g.
// http -> https, or a bare domain -> www).
const MAX_REDIRECTS = 5;

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

// IPv4/IPv6 ranges that should never be reachable from a feed URL: loopback,
// private/RFC1918, link-local (which is also where the AWS/GCP/Azure/Vercel cloud
// metadata endpoint lives at 169.254.169.254), carrier-grade NAT, and IPv6's
// unique-local/link-local equivalents. This is a blocklist of "obviously not a
// public blog," not an allowlist -- it deliberately stays permissive about the rest
// of the public internet, which is exactly where real blogs live.
function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918 private
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 private
    if (a === 192 && b === 168) return true; // RFC1918 private
    if (a === 169 && b === 254) return true; // link-local -- includes cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 0) return true; // "this network"
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 address -- unwrap and re-check the embedded IPv4 address
      // rather than letting this form sail through unchecked.
      return isPrivateOrReservedIp(lower.slice('::ffff:'.length));
    }
    return false;
  }
  return true; // not a recognizable IP literal -- fail closed rather than guess
}

// Resolves `hostname` and throws if it's blocked outright or if ANY of its resolved
// addresses are private/reserved. Note this check and the actual TCP connection
// fetch() makes moments later are two separate DNS lookups -- a sufficiently
// well-timed DNS rebinding attack (the name resolving to a public IP here, then to
// 127.0.0.1 on fetch()'s own lookup a few milliseconds later) could theoretically
// slip through. That gap is accepted here: closing it fully requires pinning the
// resolved IP and connecting to it directly (bypassing fetch()'s own resolution),
// which is a meaningfully bigger change for a risk that requires an attacker to both
// control DNS for their own domain AND win a very small race -- worth writing down
// so a future reader doesn't assume this function is airtight.
async function assertPublicHost(hostname) {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith('.local')) {
    throw new Error('That host is not allowed.');
  }
  if (net.isIP(lower)) {
    if (isPrivateOrReservedIp(lower)) throw new Error('That host is not allowed.');
    return;
  }
  let records;
  try {
    records = await dns.lookup(lower, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve that host.');
  }
  if (records.length === 0) throw new Error('Could not resolve that host.');
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('That host resolves to a private address, which is not allowed.');
    }
  }
}

// Validates a feed URL is even worth trying -- used both when a creator first saves
// the URL (fast feedback in Settings) and again right before every sync (the check
// that actually matters, since what a hostname resolves to can change between the
// two). Only checks scheme/host reachability, not whether a feed actually lives
// there -- that's what the real fetch in fetchFeedXml finds out.
export async function assertSafeFeedUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http:// or https:// feed URLs are allowed.');
  }
  await assertPublicHost(url.hostname);
}

// Reads a fetch Response body up to `maxBytes`, throwing rather than silently
// truncating -- a feed that's actually too large should surface as a clear sync
// error, not get parsed from a corrupt partial read.
async function readBodyWithLimit(res, maxBytes) {
  const contentLength = Number(res.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Feed response is too large.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error('Feed response is too large.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

// Fetches `feedUrl` and returns its raw body as text, ready for lib/rss.js's
// parseFeed. Handles the SSRF checks above, a hard timeout, a manual (re-validated)
// redirect chain, and a response-size cap -- everything a plain `await
// fetch(feedUrl)` does not.
export async function fetchFeedXml(feedUrl) {
  let currentUrl = feedUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeFeedUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        // A few blog hosts (WordPress.com among them) reject requests with no
        // User-Agent outright -- a plain, identifiable one avoids that without
        // pretending to be a browser.
        headers: { 'User-Agent': 'ByUsBot/1.0 (+https://byusapp.com)' },
      });
    } finally {
      clearTimeout(timeout);
    }

    // `redirect: 'manual'` surfaces a redirect as an opaqueredirect-style response
    // rather than following it -- status is typically 0, so the Location header is
    // what actually carries the destination. Every hop re-enters this same loop,
    // which means the new URL gets the exact same assertSafeFeedUrl check the
    // original one did.
    const isRedirect = res.status >= 300 && res.status < 400;
    if (isRedirect) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Feed redirected with no destination.');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    return readBodyWithLimit(res, MAX_RESPONSE_BYTES);
  }
  throw new Error('Feed redirected too many times.');
}
