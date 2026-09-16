'use client';

import { useEffect } from 'react';

// Registers public/sw.js — the missing piece for real "Add to Home Screen" support on
// Chrome/Android (app/manifest.js and the icons already handle Safari's version, which
// doesn't require a service worker at all). Production-only and fully best-effort: if
// registration fails or the browser doesn't support service workers, the site just
// works exactly as it already did, no install prompt, nothing broken.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  }, []);

  return null;
}
