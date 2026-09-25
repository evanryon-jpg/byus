'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track as vercelTrack } from '@vercel/analytics';

// <Analytics /> (app/layout.js) sets up window.va in its own effect, which runs AFTER this
// component's effects -- so an event fired during the first render of a page (the
// funnel_signup_viewed below, on a direct load of /signup) hit an undefined window.va and
// was silently dropped: 9 visitors loaded /signup and 0 views were ever recorded. This
// installs the same queue @vercel/analytics installs itself (window.vaq), so an early event
// waits in line and is sent once the script loads.
function track(name, properties) {
  if (typeof window !== 'undefined' && !window.va) {
    window.va = function queueAnalyticsCall(...params) {
      if (!window.vaq) window.vaq = [];
      window.vaq.push(params);
    };
  }
  vercelTrack(name, properties);
}

export default function ConversionAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Remembers the previous page in this tab so a creator page can tell whether the visitor
  // arrived from Discover, Browse, the homepage or another ByUs page (see
  // app/components/SupporterSourceCapture.jsx).
  useEffect(() => {
    try {
      const current = sessionStorage.getItem('byus_cur_path');
      if (current !== pathname) {
        sessionStorage.setItem('byus_prev_path', current || '');
        sessionStorage.setItem('byus_cur_path', pathname);
      }
    } catch {
      // storage blocked -- the creator page falls back to the referrer
    }
  }, [pathname]);

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
