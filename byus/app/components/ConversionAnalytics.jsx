'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';

export default function ConversionAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === '/signup') {
      track('Signup Page Viewed', { role: searchParams.get('role') === 'creator' ? 'creator' : 'fan' });
    }
    if (pathname?.startsWith('/creator/') && searchParams.get('subscribed') === 'true') {
      track('Subscription Completed');
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
        if (url.pathname === '/signup') track('Signup CTA Clicked', { ...props, role: url.searchParams.get('role') === 'creator' ? 'creator' : 'fan' });
        else if (url.pathname === '/browse') track('Browse Creators Clicked', props);
        else if (url.pathname === '/demo') track('Live Demo Clicked', props);
        else if (url.pathname.startsWith('/creator/')) track('Creator Profile Clicked', props);
        return;
      }

      const button = target.closest('button');
      if (button?.textContent?.trim() === 'Subscribe') {
        track('Subscribe Clicked', { source_path: window.location.pathname });
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
