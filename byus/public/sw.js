// Deliberately minimal. ByUs is a live, personalized, payment-adjacent app -- this
// service worker does NOT cache pages, API responses, or account data, because caching
// any of that risks showing a subscriber stale or wrong content (or a stale build)
// after a deploy. Its only two jobs: (1) exist with a fetch handler, which is what
// Chrome/Android require before they'll offer "Add to Home Screen" for the manifest in
// app/manifest.js, and (2) show a small offline fallback for a full page load when
// there's genuinely no network, instead of the browser's generic dinosaur error.
const OFFLINE_URL = '/offline.html';
const CACHE_NAME = 'byus-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only ever intercept full page navigations -- every other request (API calls,
  // images, the Next.js build assets) goes straight to the network untouched, so
  // nothing here can ever serve someone a stale subscriber page or a stale deploy.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
