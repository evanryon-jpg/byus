'use client';

import { useEffect } from 'react';

function recordCampaignEvent(event) {
  try {
    fetch('/api/campaign-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign: 'instagram', event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never interrupt the page or its links.
  }
}

export function InstagramCampaignView() {
  useEffect(() => {
    recordCampaignEvent('view');
  }, []);

  return null;
}

export function InstagramCampaignLink({ href, event, className, children }) {
  return (
    <a href={href} className={className} onClick={() => recordCampaignEvent(event)}>
      {children}
    </a>
  );
}
