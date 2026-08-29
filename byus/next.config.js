// Global security headers, applied to every response. `script-src` needs
// 'unsafe-inline': Next.js's App Router hydrates every page via inline <script> tags
// it injects itself (verified in production -- this build does not apply a nonce to
// those from the `x-nonce` request header the way Next's docs describe, so a
// nonce-only `script-src` silently blocks hydration on every page: the HTML renders
// but nothing is ever interactive). There's no client-side Stripe.js or other
// third-party script on this app -- Checkout is a server-created session the client
// only redirects to -- and no user content is ever rendered as HTML or executed as
// script, so the residual risk from allowing inline scripts is low. Vercel
// Analytics/Speed Insights are served and collected through same-origin paths Vercel
// proxies at the edge (/_vercel/insights/*, /_vercel/speed-insights/*), so they need
// no extra CSP allowances either.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'", // Next.js/Tailwind can inject small inline styles
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
