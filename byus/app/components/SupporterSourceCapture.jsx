'use client';

// Rendered on every creator page (app/creator/[creatorId]/page.js). The first time this
// visitor lands on this creator's page, record how they got here in the byus_src cookie --
// see lib/supporter-source.js for the whole flow. Renders nothing.
//
// How "how they got here" is decided, in order:
//   1. ?via=<source> on the link (for ByUs surfaces that tag their links, e.g. future
//      creator recommendations).
//   2. The previous page in this tab was a ByUs page (tracked in sessionStorage by
//      app/components/ConversionAnalytics.jsx) -> discover / browse / home / byus_page.
//   3. A same-site referrer (a ByUs link opened in a new tab) -> classified the same way.
//   4. Otherwise they came from outside ByUs: a paid-ad utm_medium -> ad; a search-engine
//      referrer -> search; anything else (the creator's own link, a social post, typing the
//      address) -> creator_link.

import { useEffect } from 'react';
import {
  SUPPORTER_SOURCE_COOKIE,
  SUPPORTER_SOURCE_MAX_AGE_SECONDS,
  isSupporterSource,
  parseSupporterSourceCookie,
  serializeSupporterSourceCookie,
  todayDayNumber,
} from '@/lib/supporter-source';

const AD_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'paid-social', 'ad', 'ads', 'display', 'sponsored'];
const SEARCH_HOST_RE = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|startpage|brave|qwant)\./i;

function sourceFromByUsPath(path) {
  if (!path) return null;
  if (path === '/') return 'home';
  if (path.startsWith('/discover')) return 'discover';
  if (path.startsWith('/browse')) return 'browse';
  return 'byus_page';
}

function readCookie() {
  const match = document.cookie.split(/;\s*/).find((c) => c.startsWith(`${SUPPORTER_SOURCE_COOKIE}=`));
  return match ? match.slice(SUPPORTER_SOURCE_COOKIE.length + 1) : '';
}

function classifyArrival(currentPath) {
  const params = new URLSearchParams(window.location.search);
  const via = params.get('via');
  if (isSupporterSource(via)) return via;

  // Previous page in this tab. ConversionAnalytics may or may not have recorded the
  // current page yet (effect order), so skip over it if it has.
  let previousPath = null;
  try {
    const cur = sessionStorage.getItem('byus_cur_path');
    previousPath = cur && cur !== currentPath ? cur : sessionStorage.getItem('byus_prev_path');
  } catch { /* storage blocked */ }
  if (previousPath && previousPath !== currentPath) return sourceFromByUsPath(previousPath);

  let referrer = null;
  try { referrer = document.referrer ? new URL(document.referrer) : null; } catch { referrer = null; }
  if (referrer && referrer.host === window.location.host && referrer.pathname !== currentPath) {
    return sourceFromByUsPath(referrer.pathname);
  }

  if (AD_MEDIUMS.includes((params.get('utm_medium') || '').toLowerCase())) return 'ad';
  if (referrer && SEARCH_HOST_RE.test(referrer.hostname)) return 'search';
  return 'creator_link';
}

export default function SupporterSourceCapture({ creatorId }) {
  useEffect(() => {
    if (!creatorId) return;
    try {
      const entries = parseSupporterSourceCookie(readCookie());
      const key = String(creatorId).toLowerCase();
      if (entries.has(key)) return; // first visit already recorded -- never overwrite
      entries.set(key, { source: classifyArrival(window.location.pathname), day: todayDayNumber() });
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${SUPPORTER_SOURCE_COOKIE}=${encodeURIComponent(serializeSupporterSourceCookie(entries))}; Path=/; Max-Age=${SUPPORTER_SOURCE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    } catch {
      // Cookies blocked or unavailable: the supporter just shows as untracked.
    }
  }, [creatorId]);

  return null;
}
