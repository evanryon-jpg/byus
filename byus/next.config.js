// Global security headers, applied to every response. The Content-Security-Policy header
// is intentionally NOT set here: it needs a fresh nonce per request so Next.js's own
// inline hydration scripts can run (App Router injects inline <script> tags to hydrate
// every page — a static, nonce-less `script-src 'self'` blocks those silently, leaving
// every page rendered but non-interactive). middleware.js sets the real CSP dynamically,
// per request, with that request's nonce. Vercel Analytics/Speed Insights are served and
// collected through same-origin paths Vercel proxies at the edge (/_vercel/insights/*,
// /_vercel/speed-insights/*), so they need no extra CSP allowances either way.
const securityHeaders = [
  // Legacy fallback for browsers that don't honor frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Only takes effect over HTTPS (which is all Vercel serves in production) — tells
  // browsers to never even attempt a plain-HTTP request to this host again.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
