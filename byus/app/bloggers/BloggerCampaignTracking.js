'use client';

// Same pattern as app/instagram/InstagramCampaignTracking.js, just pinned to the
// 'blogger' campaign (see the ALLOWED_CAMPAIGNS set in app/api/campaign-metrics/route.js)
// instead of duplicating that component with a hardcoded campaign name changed.

import { useEffect } from 'react';

function recordCampaignEvent(event) {
  try {
    fetch('/api/campaign-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign: 'blogger', event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never interrupt the page or its links.
  }
}

export function BloggerCampaignView() {
  useEffect(() => {
    recordCampaignEvent('view');
  }, []);

  return null;
}

export function BloggerCampaignLink({ href, event, className, children }) {
  return (
    <a href={href} className={className} onClick={() => recordCampaignEvent(event)}>
      {children}
    </a>
  );
}
