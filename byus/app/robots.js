// Auto-served at /robots.txt by Next.js's file-based robots convention -- nothing else
// needs to reference this file. Disallows only routes with no search-relevant content:
// the API surface, admin tooling, and pages that only mean anything to an already-
// logged-in account (settings, dashboards, onboarding, password reset). Marketing and
// discovery pages, and public creator profiles, stay crawlable.
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/admin/',
        '/settings',
        '/creator/dashboard',
        '/creator/onboarding',
        '/fan/dashboard',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: 'https://byusapp.com/sitemap.xml',
  };
}
