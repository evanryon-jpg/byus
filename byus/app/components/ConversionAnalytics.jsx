'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';

export default function ConversionAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === '/signup') {
      track('funnel_signup_viewed', { role: searchParams.get('role') === 'creator' ? 'creator' : 'fan' });
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const link = target.closest('a[href]');
      if (link) {
        let url;
        try { url = new URL(link.href, window.location.origin); } catch { return; }
        if (url.origin !== window.location.origin) return;
        const props = { source_path: window.location.pathname };
        if (url.pathname === '/signup') track('funnel_signup_started', { ...props, role: url.searchParams.get('role') === 'creator' ? 'creator' : 'fan', provider: 'email_or_oauth' });
        else if (url.pathname === '/api/auth/google') track('funnel_signup_started', { ...props, role: url.searchParams.get('role') === 'creator' ? 'creator' : 'fan', provider: 'google' });
        else if (url.pathname === '/api/auth/apple') track('funnel_signup_started', { ...props, role: url.searchParams.get('role') === 'creator' ? 'creator' : 'fan', provider: 'apple' });
        else if (url.pathname === '/browse') track('browse_creators_clicked', props);
        else if (url.pathname === '/demo') track('live_demo_clicked', props);
        else if (url.pathname.startsWith('/creator/')) track('creator_profile_clicked', props);
        return;
      }

      const button = target.closest('button');
      if (button?.textContent?.trim() === 'Subscribe') {
        track('subscribe_clicked', { source_path: window.location.pathname });
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
